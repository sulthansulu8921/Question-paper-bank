import { useThemeStore } from '@/store/useThemeStore';

interface LogoProps {
    className?: string;
    style?: React.CSSProperties;
    alt?: string;
    theme?: 'light' | 'dark';
}

export default function Logo({ className, style, alt = "Qubook Logo", theme }: LogoProps) {
    const activeTheme = useThemeStore((state) => state.theme);
    const resolvedTheme = theme || activeTheme;
    const logoSrc = resolvedTheme === 'dark' ? '/logo-dark.png' : '/logo-light.png';
    return (
        <img
            src={logoSrc}
            alt={alt}
            className={className}
            style={style}
        />
    );
}
