/**
 * Metro choisit `confirm.web.ts` ou `confirm.native.ts` selon la plateforme.
 * Cette declaration donne a TypeScript la forme commune aux deux.
 */
export type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export declare function confirmAsync(
  message: string,
  options?: ConfirmOptions
): Promise<boolean>;
