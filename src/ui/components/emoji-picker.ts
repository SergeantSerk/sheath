/**
 * EmojiPicker provides a dropdown emoji selector for the chat input.
 * Renders a grid of common emojis and inserts them at cursor position.
 */
export class EmojiPicker {
  private emojiPicker!: HTMLElement;

  /**
   * Initializes the emoji picker element and renders emoji buttons.
   */
  initialize() {
    this.emojiPicker = document.getElementById("emojiPicker")!;
    this.renderEmojis();
  }

  /**
   * Renders all emoji buttons and attaches click handlers.
   * Uses a curated list of common emojis for quick access.
   */
  private renderEmojis() {
    const emojis = [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😮", "😯", "😲", "😳", "🥺", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾", "🙈", "🙉", "🙊", "💋", "💌", "💘", "💝", "💖", "💗", "💓", "💞", "💕", "💟", "❣️", "💔", "❤️", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍", "💯", "💢", "💥", "💫", "💦", "💨", "🕳️", "💣", "💬", "👁️‍🗨️", "🗨️", "🗯️", "💭", "💤", "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤏", "✌️", "🤞", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾", "🦵", "🦿", "🦶", "👣", "👂", "🦻", "👃", "🧠", "🦷", "🦴", "👀", "👁️", "👅", "👄", "👶", "🧒", "👦", "👧", "🧑", "👱", "👨", "🧔", "👩", "🧓", "👴", "👵", "🚀", "🛸", "🚁", "🛶", "⛵", "🚤", "🚢", "🛫", "🛬", "🛰️", "🚲", "🛴", "🛵", "🏍️", "🏎️", "🚜", "🏘️", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🏯", "🏰", "💒", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩️", "🕋", "⚡", "🔥", "⛄", "☃️", "❄️", "☄️", "🌈", "☀️", "🌤️", "⛅", "🌥️", "☁️", "🌦️", "🌧️", "⛈️", "🌩️", "🌨️"
    ];

    this.emojiPicker.innerHTML = emojis
      .map(emoji => `<button class="emoji-item">${emoji}</button>`)
      .join("");

    this.emojiPicker.querySelectorAll(".emoji-item").forEach(btn => {
      btn.addEventListener("click", () => {
        this.insertEmoji(btn.textContent || "");
        this.hide();
      });
    });
  }

  /**
   * Toggles the emoji picker visibility.
   */
  toggle() {
    this.emojiPicker.classList.toggle("hidden");
  }

  /**
   * Hides the emoji picker.
   */
  hide() {
    this.emojiPicker.classList.add("hidden");
  }

  /**
   * Inserts an emoji at the cursor position in the message input.
   * Preserves cursor position and focuses the input.
   */
  private insertEmoji(emoji: string) {
    const messageInput = document.getElementById("messageInput") as HTMLInputElement;
    const start = messageInput.selectionStart || 0;
    const end = messageInput.selectionEnd || 0;
    const text = messageInput.value;
    messageInput.value = text.substring(0, start) + emoji + text.substring(end);
    messageInput.selectionStart = messageInput.selectionEnd = start + emoji.length;
    messageInput.focus();
  }
}
