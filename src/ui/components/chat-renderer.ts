/**
 * ChatRenderer handles message display in the chat container.
 * Supports text messages, images, and system notifications.
 */
export class ChatRenderer {
  private messagesContainer!: HTMLElement;

  /**
   * Initializes the messages container reference.
   */
  initialize() {
    this.messagesContainer = document.getElementById("messagesContainer")!;
  }

  /**
   * Adds a message to the chat.
   * @param content - Text string or Blob (image)
   * @param type - Message type: sent, received, or system
   */
  addMessage(content: string | Blob, type: "sent" | "received" | "system") {
    const el = document.createElement("div");
    el.className = `message message-${type}`;

    if (type === "system") {
      // System messages are plain text
      el.textContent = content as string;
    } else {
      // User messages (sent or received)
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      if (content instanceof Blob) {
        // Image message
        const url = URL.createObjectURL(content);
        el.classList.add("message-image-container");
        el.innerHTML = `
          <div class="message-content">
            <img src="${url}" class="chat-image" alt="Shared image" />
            <span class="message-time">${time}</span>
          </div>
        `;

        // Security: prevent right-click save and drag
        const img = el.querySelector("img");
        if (img) {
          img.onload = () => URL.revokeObjectURL(url); // Clean up memory
          img.oncontextmenu = (e) => e.preventDefault();
          img.ondragstart = (e) => e.preventDefault();
        }
      } else {
        // Text message
        const isEmoji = this.isEmojiOnly(content as string);
        const emojiClass = isEmoji ? "emoji-only" : "";
        el.innerHTML = `
          <span class="message-text ${emojiClass}">${this.escapeHtml(content)}</span>
          <span class="message-time">${time}</span>
        `;
      }
    }

    // Append and scroll to bottom
    this.messagesContainer.appendChild(el);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * Checks if text consists only of emoji characters.
   * Used for special styling of emoji-only messages.
   */
  private isEmojiOnly(text: string): boolean {
    return /^[\p{Emoji}\p{Emoji_Presentation}\u200D\uFE0F]+$/u.test(text);
  }

  /**
   * Escapes HTML special characters to prevent XSS.
   */
  private escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}
