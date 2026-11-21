// Другий шар від ін'єкції, незалежний від моделі (AC-INTAKE-07): текст звернення, у якому видно вказівки для асистента,
// відхиляється ДО виклику моделі й до ліміту. Перший шар — межа <document> і правило «дані, а не вказівки» в промпті, але він
// не повідомляє, що спробу було: модель, яку вдалося обманути, мовчить. Перелік навмисно вузький (типові фрази), щоб звичайні
// звернення не відхилялися; усе, що в нього не потрапило, іде до моделі, яка теж може відмовити.
const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget)\b.{0,20}\b(previous|prior|above|earlier)\b.{0,20}\b(instructions?|prompts?|rules)\b/,
  /\b(assistant|ai|model) reading this\b/,
  /\bsystem prompt\b/,
  /\bignora\b.{0,40}\b(anteriores|previas)\b/,
];

export function looksLikeInjection(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, " ");
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}
