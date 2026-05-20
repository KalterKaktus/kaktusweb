# KalterKaktus Design System

Use this when adding or changing pages.

## Direction

The site should feel dark, toxic green, and Matrix-inspired:

- dark background
- subtle grid texture
- poisonous green accents
- glassy dark cards
- thin green borders and soft glow
- compact, dashboard-like layout

Do not use light mode. Do not use beige/cream themes. Do not add generic particles or falling Matrix rain unless explicitly requested.

## Source Of Truth

Global design tokens live in `styles.css` under `:root`.

Use these variables instead of hardcoded colors:

- `--bg-primary`
- `--bg-secondary`
- `--card-bg`
- `--card-hover`
- `--text-primary`
- `--text-secondary`
- `--accent`
- `--accent-light`
- `--accent-hot`
- `--border`

When the style changes, update these variables first so all pages follow the same look.

## Components

Preferred style for new sections:

- border: `1px solid var(--border)`
- border-radius: `8px`
- background: `var(--card-bg)`
- text color: `var(--text-primary)`
- secondary text: `var(--text-secondary)`
- hover border: `var(--accent-light)`

The Free Games page should use the same tokens and not create a separate visual theme.
