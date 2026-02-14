/**
 * Browser shim for linkedom - provides parseHTML using native DOMParser
 * This replaces the Node.js linkedom package in browser builds
 */

/**
 * Parse an HTML string into a DOM-like document
 * Compatible with linkedom's parseHTML API
 */
export function parseHTML(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

/**
 * Parse an XML string into a DOM document
 */
export function parseXML(xml: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xml, 'application/xml');
}

/**
 * Create a DOM element with the given tag name
 */
export function createElement(tagName: string): HTMLElement {
  return document.createElement(tagName);
}

/**
 * Create a document fragment
 */
export function createDocumentFragment(): DocumentFragment {
  return document.createDocumentFragment();
}

export default {
  parseHTML,
  parseXML,
  parseFromString: parseHTML,
  document: {
    createElement,
    createDocumentFragment,
  },
};
