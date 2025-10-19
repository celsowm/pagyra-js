export function defaultDisplayForTag(tag: string): 'block'|'inline'|'inline-block'|'table'|'table-row'|'table-cell' {
  let display: string;
  switch (tag) {
    case "span":
    case "a":
    case "strong":
    case "em":
    case "b":
    case "s":
    case "strike":
    case "del":
    case "label":
    case "code":
    case "small":
    case "time":
      display = 'inline';
      break;
    case "table":
      display = 'table';
      break;
    case "tbody":
    case "thead":
    case "tfoot":
      display = 'table-row-group';
      break;
    case "tr":
      display = 'table-row';
      break;
    case "td":
    case "th":
      display = 'table-cell';
      break;
    case "caption":
      display = 'table-caption';
      break;
    case "flex":
    case "div":
    case "section":
    case "main":
    case "article":
    case "header":
    case "footer":
    case "nav":
    case "p":
    case "ul":
    case "ol":
    case "li":
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      display = 'block';
      break;
    default:
      display = 'block';
      break;
  }
  return display as 'block'|'inline'|'inline-block'|'table'|'table-row'|'table-cell'|any; // adjust types if needed
}

export const UA_DEFAULTS = {
  fontFamily: 'Arial, sans-serif',
  fontSizePx: 16,
  lineHeight: 1.2,
  color: '#000',
  // add what you already had
};
