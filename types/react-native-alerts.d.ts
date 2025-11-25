declare module 'react-native-alerts' {
  interface AlertOptions {
    title?: string;
    message?: string;
    button?: string;
  }

  interface ConfirmOptions {
    title?: string;
    message?: string;
    accept?: string;
    cancel?: string;
  }

  interface PromptOptions {
    title?: string;
    message?: string;
    inputtype?: number;
    placeholder?: string;
    accept?: string;
    cancel?: string;
  }

  interface LoginOptions {
    title?: string;
    message?: string;
    userInputType?: number;
    userPlaceholder?: string;
    passwordInputType?: number;
    passwordPlaceholder?: string;
    accept?: string;
    cancel?: string;
  }

  class Alerts {
    static inputTypes: {
      TEXT: number;
      EMAIL: number;
      NUMBER: number;
      PASSWORD: number;
      PHONE: number;
    };

    static alert(options: AlertOptions, callback?: () => void): void;
    static confirm(
      options: ConfirmOptions,
      callback?: (accepted: boolean) => void
    ): void;
    static prompt(
      options: PromptOptions,
      callback?: (result: string | null) => void
    ): void;
    static login(
      options: LoginOptions,
      callback?: (result: { username: string; password: string } | null) => void
    ): void;
  }

  export default Alerts;
}
