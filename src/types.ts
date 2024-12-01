export interface GenerateImageArgs {
    prompt: string;
    size?: string;
  }
  
  export function isValidGenerateImageArgs(args: any): args is GenerateImageArgs {
    return (
      typeof args === "object" &&
      args !== null &&
      "prompt" in args &&
      typeof args.prompt === "string" &&
      (args.size === undefined || typeof args.size === "string")
    );
  }
  