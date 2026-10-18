export interface ExtensionConfig {
  supabaseUrl: string;
  publishableKey: string;
  apiUrl: string;
}

declare const __EXTENSION_CONFIG__: ExtensionConfig;

export const extensionConfig: ExtensionConfig = __EXTENSION_CONFIG__;
