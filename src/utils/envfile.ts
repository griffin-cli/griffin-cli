import normalizeEnvVarName from './normalize-env-var-name';

export default class EnvFile {
  private static newlinePattern = /[^\\]\n/;

  private static specialCharacterPattern = /[#'"]/;

  static stringify(data: Record<string, string | boolean | number | undefined | null>): string {
    return Object.keys(data).reduce((acc, key) => {
      if (data[key] === undefined) {
        return acc;
      }

      const normalizedKey = normalizeEnvVarName(key);

      if (data[key] === null) {
        return `${acc}${normalizedKey}=\n`;
      }

      let value = data[key];

      if (typeof value === 'string') {
        if (this.newlinePattern.test(value) || this.specialCharacterPattern.test(value)) {
          let quote = '"';

          if (value.includes('"')) {
            // If the value contains both double and single quotes, not much we can do. Some dotenv
            // libraries support backticks, but that doesn't appear to be standard. If a value
            // contains special characters not considered here, the user should consider base64
            // encoding the value.
            quote = '\'';
          }

          value = `${quote}${value}${quote}`;
        }
      }

      return `${acc}${normalizedKey}=${value}\n`;
    }, '');
  }
}
