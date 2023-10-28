export default (name: string): string => name.toUpperCase().replaceAll(/\W/g, '_');
