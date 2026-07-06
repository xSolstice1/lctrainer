import {
  BedrockRuntimeClient,
  InvokeModelWithResponseStreamCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockClient,
  ListFoundationModelsCommand,
  ListInferenceProfilesCommand,
} from "@aws-sdk/client-bedrock";
import type { ModelInfo, GuidanceChunk, GuidanceRequest } from "@lctrainer/shared";
import type { LLMProvider } from "./LLMProvider.js";
import { buildUserMessage } from "./openAiCompat.js";

export interface BedrockProviderConfig {
  region: string;
  profile?: string;
  modelId: string;
}

const SSO_LOGIN_HINT = (profile?: string) =>
  `AWS SSO session expired or not found — run: aws sso login${profile ? ` --profile ${profile}` : ""}`;

export class BedrockProvider implements LLMProvider {
  private readonly runtimeClient: BedrockRuntimeClient;
  private readonly controlClient: BedrockClient;
  private readonly defaultModelId: string;
  private readonly profile?: string;

  constructor(config: BedrockProviderConfig) {
    // No explicit `credentials` — relies on the SDK v3 default credential
    // provider chain to resolve an AWS_PROFILE-backed SSO session
    // (~/.aws/config + cached SSO token under ~/.aws/sso/cache).
    if (config.profile) {
      process.env.AWS_PROFILE = config.profile;
    }
    this.runtimeClient = new BedrockRuntimeClient({ region: config.region });
    this.controlClient = new BedrockClient({ region: config.region });
    this.defaultModelId = config.modelId;
    this.profile = config.profile;
  }

  /**
   * Lists invocable Anthropic Claude models on Bedrock, combining two
   * sources:
   *  - Cross-region inference profiles (preferred) — this is the required
   *    invocation path for most current-generation Claude models on
   *    Bedrock; a bare on-demand call to these fails with "isn't
   *    supported... retry with an inference profile".
   *  - Foundation models that still support direct ON_DEMAND invocation
   *    (mostly older Claude 3 models).
   * Either kind is passed straight through as `modelId` to
   * InvokeModelWithResponseStreamCommand — the Bedrock runtime API accepts
   * an inference profile ID/ARN in the same `modelId` field as a plain
   * model ID.
   */
  async listClaudeModels(): Promise<ModelInfo[]> {
    const [foundationModels, inferenceProfiles] = await Promise.all([
      this.controlClient.send(new ListFoundationModelsCommand({})),
      this.controlClient.send(new ListInferenceProfilesCommand({})),
    ]);

    const onDemandModels = (foundationModels.modelSummaries ?? [])
      .filter(
        (m) =>
          m.providerName === "Anthropic" &&
          m.outputModalities?.includes("TEXT") &&
          m.responseStreamingSupported &&
          m.inferenceTypesSupported?.includes("ON_DEMAND") &&
          m.modelId
      )
      .map((m) => ({ modelId: m.modelId!, modelName: m.modelName ?? m.modelId! }));

    const profiles = (inferenceProfiles.inferenceProfileSummaries ?? [])
      .filter(
        (p) =>
          p.status === "ACTIVE" &&
          p.inferenceProfileId &&
          p.models?.some((m) => m.modelArn?.includes("anthropic.claude"))
      )
      .map((p) => ({ modelId: p.inferenceProfileId!, modelName: p.inferenceProfileName ?? p.inferenceProfileId! }));

    return [...profiles, ...onDemandModels];
  }

  async *streamGuidance(
    request: GuidanceRequest,
    systemPrompt: string,
    signal?: AbortSignal
  ): AsyncGenerator<GuidanceChunk> {
    const userMessage = buildUserMessage(request);

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      system: systemPrompt,
      messages: [...(request.history ?? []), { role: "user", content: userMessage }],
      max_tokens: request.allowFullSolution ? 1536 : 512,
    };

    try {
      const response = await this.runtimeClient.send(
        new InvokeModelWithResponseStreamCommand({
          modelId: request.modelId || this.defaultModelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(payload),
        }),
        { abortSignal: signal }
      );

      for await (const event of response.body ?? []) {
        if (!event.chunk?.bytes) continue;
        const decoded = JSON.parse(Buffer.from(event.chunk.bytes).toString("utf-8"));
        if (decoded.type === "content_block_delta" && decoded.delta?.text) {
          yield { type: "token", delta: decoded.delta.text };
        }
        if (decoded.type === "message_stop") {
          yield { type: "done" };
          return;
        }
      }
      yield { type: "done" };
    } catch (err: any) {
      const name = err?.name ?? "";
      if (name === "ExpiredTokenException" || name === "UnauthorizedException" || name === "CredentialsProviderError") {
        yield { type: "error", message: SSO_LOGIN_HINT(this.profile) };
        return;
      }
      yield { type: "error", message: err?.message ?? "Bedrock request failed" };
    }
  }
}
