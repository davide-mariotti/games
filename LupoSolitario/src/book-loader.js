// Loads a book's JSON once per session.
const cache = {};

export const bookLoader = {
  async loadBook(bookId) {
    if (!cache[bookId]) {
      const response = await fetch(`./data/books/${bookId}.json`);
      if (!response.ok) throw new Error(`Failed to load book ${bookId}: ${response.status}`);
      const book = await response.json();
      if (!book.sections) throw new Error(`Invalid book data: ${bookId} has no sections`);
      cache[bookId] = book;
    }
    return cache[bookId];
  },
};
