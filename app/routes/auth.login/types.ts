export interface LoginErrorMessage {
  shop?: string;
}

export type LoginErrorResp = {
  errors: LoginErrorMessage;
  polarisTranslations?: any;
}

