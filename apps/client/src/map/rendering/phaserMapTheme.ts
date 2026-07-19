export type PhaserMapTheme = {
  backgroundColor: string;
  neutralTint: number;
};

export function resolvePhaserMapTheme(element: Element): PhaserMapTheme {
  const styles = getComputedStyle(element);
  const backgroundColor = requireHexThemeToken(styles, "--arc-map-water-deep");
  const neutralColor = requireHexThemeToken(styles, "--arc-map-unit-neutral");
  return {
    backgroundColor,
    neutralTint: Number.parseInt(neutralColor.slice(1), 16),
  };
}

function requireHexThemeToken(styles: CSSStyleDeclaration, token: string): string {
  const value = styles.getPropertyValue(token).trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`PHASER_MAP_THEME_TOKEN_INVALID:${token}`);
  }
  return value;
}
