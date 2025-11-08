# UA styles do Chromium/Blink — Tabelas Markdown

## Blocos básicos
| Seletor | display | margin (block) | margin (inline) | Outros |
|---|---|---:|---:|---|
| `html` | block | – | – | – |
| `body` | block | `8px` (todas as direções) | – | – |
| `p` | block | `1em` topo/baixo | `0` esq/dir | – |
| `div` | block | – | – | – |
| `blockquote` | block | `1em` top/`1em` bottom | `40px` esq/dir | – |
| `figure` | block | `1em` top/`1em` bottom | `40px` esq/dir | – |
| `hr` | block | `0.5em` top/bottom | auto | `border: 1px inset; color: gray; overflow: hidden` |

## Cabeçalhos
| Seletor | display | font-size | margin-block | font-weight | Notas |
|---|---|---|---|---|---|
| `h1` | block | `2em` | `0.67em` / `0.67em` | bold | – |
| `h2` | block | `1.5em` | `0.83em` / `0.83em` | bold | – |
| `h3` | block | `1.17em` | `1em` / `1em` | bold | – |
| `h4` | block | `1em` aprox. | `1.33em` / `1.33em` | bold | – |
| `h5` | block | `.83em` | `1.67em` / `1.67em` | bold | – |
| `h6` | block | `.67em` | `2.33em` / `2.33em` | bold | – |

## Listas
| Seletor | display | list-style | margin-block | padding-inline-start |
|---|---|---|---|---|
| `ul, menu, dir` | block | disc | `1em` / `1em` | `40px` |
| `ol` | block | decimal | `1em` / `1em` | `40px` |
| `li` | list-item | – | – | `text-align: match-parent` |
| `dl` | block | – | `1em` / `1em` | – |
| `dt` | block | – | – | – |
| `dd` | block | – | – | `margin-inline-start: 40px` |

## Tabelas
| Seletor | display | border | spacing | vertical-align | Outros |
|---|---|---|---|---|---|
| `table` | table | `border-collapse: separate` | `2px` | – | `box-sizing: border-box; text-indent: initial; border-color: gray` |
| `thead` | table-header-group | – | – | middle | – |
| `tbody` | table-row-group | – | – | middle | – |
| `tfoot` | table-footer-group | – | – | middle | – |
| `tr` | table-row | – | – | inherit | – |
| `td, th` | table-cell | – | – | inherit | `padding: 1px` |
| `th` | table-cell | – | – | inherit | `font-weight: bold; text-align: center` |
| `caption` | table-caption | – | – | – | `text-align: center` |

## Links
| Seletor | Cor | Decoração | Cursor | Foco |
|---|---|---|---|---|
| `a:-webkit-any-link` | `-webkit-link` | underline | pointer | `:focus-visible { outline-offset: 1px }` |
| `a:-webkit-any-link:active` | `-webkit-activelink` | – | – | – |
| `a:-webkit-any-link:read-write` | – | – | text | – |

## Formulários (núcleo)
| Seletor | display | margin | font | Outros |
|---|---|---|---|---|
| `form` | block | `margin-top: 0` | – | – |
| `fieldset` | block | `margin-inline: 2px` | – | `border: groove 2px ThreeDFace; padding-block: .35em .625em; padding-inline: .75em; min-inline-size: min-content` |
| `legend` | block | – | – | `padding-inline: 2px` |
| `input, textarea, select, button` | inline-block | `0` | `-webkit-small-control` | `text-align: start` |

## Mídia e conteúdo substituído
| Seletor | display/overflow | Dimensões | Outros |
|---|---|---|---|
| `audio:not([controls])` | `display: none !important` | – | – |
| `audio` | – | `width: 300px; height: 54px` | – |
| `video, canvas, img` | `overflow: clip` | – | `overflow-clip-margin: content-box` |
| `video` | – | – | `object-fit: contain` |

## Ruby
| Seletor | display | font-size | alinhamento |
|---|---|---|---|
| `ruby` | ruby | – | – |
| `ruby > rt` | ruby-text | 50% | `text-align: start` |

## Dialog & Popover
| Seletor | display/posicionamento | caixa | Cores |
|---|---|---|---|
| `dialog` | `position: absolute; inset-inline-start:0; inset-inline-end:0; margin:auto` | `width/height: fit-content; border: solid; padding: 1em` | `background: Canvas; color: CanvasText` |
| `dialog:not([open])`, `[popover]:not(:popover-open)` | `display: none` | – | – |
| `dialog[open]`, `[popover]:popover-open` | `display: block` | – | – |

## Quirks Mode (diferenças comuns)
| Item | Efeito |
|---|---|
| `img[align=left|right]` | margens laterais `3px` |
| `table` | reseta `white-space`, `line-height`, `font-*`, `color`, `text-align` |
| `input` (exceto `type=image`) e `textarea` | `box-sizing: border-box` |
| `form` | `margin-block-end: 1em` |
| `li` | `list-style-position: inside` |

> Observações
> - O UA pode variar por SO e por *quirks mode*.
> - Em resets, costuma-se zerar `body { margin: 8px }` e ajustar listas/tabelas conforme o design.
