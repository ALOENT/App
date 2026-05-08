import DOMPurify from 'dompurify';

export function sanitize(str) {
  if (typeof str !== 'string') return '';
  return DOMPurify.sanitize(str, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'],
    ALLOWED_ATTR: []
  });
}
