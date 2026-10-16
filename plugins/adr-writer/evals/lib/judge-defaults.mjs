/** Judge defaults are independent of the target model and ambient AWS credentials. */
export const BEDROCK_DEFAULTS = Object.freeze({
  provider: "bedrock",
  profile: "default",
  region: "us-east-1",
  model: "us.openai.gpt-6.1-sol",
});
