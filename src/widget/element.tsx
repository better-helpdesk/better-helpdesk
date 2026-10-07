import { createRoot, type Root } from 'react-dom/client';

import { toLocale } from '../ui/i18n';
import { inlineCss, widgetCss } from './styles';
import { type OpenRequest, Widget, type WidgetEvent } from './widget';

const MAX_ERRORS = 10;

/** `<helpdesk-widget>` and `<helpdesk-conversations>` as a host's code sees them. */
export interface HelpdeskWidgetElement extends HTMLElement {
  /** Host context attached to new reports, e.g. `{ control: 'A.5.1' }`. */
  context: Record<string, string>;
  /**
   * Opens the panel, on the form of `type` (such as `'bug'`) when the inbox
   * offers it, on its first view otherwise. `subject` and `message` start
   * that form's fields. An open panel keeps a draft the customer is writing
   * unless the host names another form.
   */
  open(options?: OpenRequest): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'helpdesk-widget': HelpdeskWidgetElement;
    'helpdesk-conversations': HelpdeskWidgetElement;
  }
}

/**
 * Registers `<helpdesk-widget>`: a launcher and panel rendered into a shadow
 * root, so host styles and widget styles never meet. Attributes: `api`,
 * `inbox`, `locale`, `types` (comma list), `org`, `identity-token`,
 * `app-version`, `label`, and
 * `theme="auto"` to follow the OS dark mode. The `context` property carries
 * host context for new reports, and `open({ type, subject, message })` opens the panel from
 * the host's own code. Emits `helpdesk:open` and `helpdesk:message-sent`.
 */
export function defineHelpdeskWidget(
  tag = 'helpdesk-widget',
  {
    owns,
    inline = false,
  }: { owns?: (element: HTMLElement) => boolean; inline?: boolean } = {}
) {
  if (typeof window === 'undefined' || customElements.get(tag)) return;

  class HelpdeskWidgetElement extends HTMLElement {
    static observedAttributes = [
      'api',
      'inbox',
      'locale',
      'types',
      'org',
      'identity-token',
      'app-version',
      'label',
    ];
    #root: Root | null = null;
    #context: Record<string, string> = {};
    #errors: string[] = [];
    #openRequest: OpenRequest | undefined;

    #onError = (event: ErrorEvent) => this.#record(event.message);
    #onRejection = (event: PromiseRejectionEvent) =>
      this.#record(
        event.reason instanceof Error
          ? event.reason.message
          : String(event.reason)
      );

    /** Re-dispatched on the element so a host can track opens and sends. */
    #emit = (event: WidgetEvent) =>
      this.dispatchEvent(
        new CustomEvent(event.name, {
          detail: 'detail' in event ? event.detail : undefined,
          bubbles: true,
          composed: true,
        })
      );

    /**
     * Typing in the widget must not reach the host page's shortcuts: outside
     * the shadow root the event's target is this element, not a text field.
     */
    #onKey = (event: KeyboardEvent) => {
      const origin = event.composedPath()[0];
      if (
        origin instanceof HTMLElement &&
        (origin.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(origin.tagName))
      ) {
        event.stopPropagation();
      }
    };

    #record(message: string) {
      this.#errors = [...this.#errors, message.slice(0, 300)].slice(
        -MAX_ERRORS
      );
    }

    /**
     * Opens the panel, on the form of `type` (such as `'bug'`) when the inbox
     * offers it, on its first view otherwise; `subject` and `message` start
     * the form's fields.
     */
    open({ type, subject, message }: OpenRequest = {}) {
      this.#openRequest = { type, subject, message };
      this.#render();
    }

    get context() {
      return this.#context;
    }

    set context(value: Record<string, string>) {
      this.#context = value ?? {};
      this.#render();
    }

    connectedCallback() {
      // An element the definer did not create stays inert.
      if (owns && !owns(this)) return;
      const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      shadow.innerHTML = '';
      const style = document.createElement('style');
      style.textContent = inline ? widgetCss + inlineCss : widgetCss;
      const container = document.createElement('div');
      shadow.append(style, container);
      this.#root = createRoot(container);
      for (const type of ['keydown', 'keyup', 'keypress'] as const) {
        this.addEventListener(type, this.#onKey);
      }
      window.addEventListener('error', this.#onError);
      window.addEventListener('unhandledrejection', this.#onRejection);
      this.#render();
    }

    disconnectedCallback() {
      // A request belongs to the moment it was made, not to the next mount.
      this.#openRequest = undefined;
      for (const type of ['keydown', 'keyup', 'keypress'] as const) {
        this.removeEventListener(type, this.#onKey);
      }
      window.removeEventListener('error', this.#onError);
      window.removeEventListener('unhandledrejection', this.#onRejection);
      // The host can remove this element while React is rendering (a route
      // change); unmounting synchronously then races that render.
      const root = this.#root;
      this.#root = null;
      queueMicrotask(() => root?.unmount());
    }

    attributeChangedCallback() {
      this.#render();
    }

    #render() {
      this.#root?.render(
        <Widget
          api={this.getAttribute('api') ?? '/api/helpdesk'}
          inbox={this.getAttribute('inbox') ?? 'support'}
          locale={toLocale(this.getAttribute('locale') ?? navigator.language)}
          types={this.getAttribute('types')
            ?.split(',')
            .map(t => t.trim())
            .filter(Boolean)}
          orgId={this.getAttribute('org') ?? undefined}
          identityToken={this.getAttribute('identity-token') ?? undefined}
          appVersion={this.getAttribute('app-version') ?? undefined}
          hostContext={this.#context}
          label={this.getAttribute('label') ?? undefined}
          inline={inline}
          openRequest={this.#openRequest}
          errors={() => this.#errors}
          onEvent={this.#emit}
        />
      );
    }
  }

  customElements.define(tag, HelpdeskWidgetElement);
}

/**
 * Registers `<helpdesk-conversations>`: the widget's conversations and threads
 * in the page itself, for a Support page in the host app. Same attributes,
 * routes and `--helpdesk-*` tokens as `<helpdesk-widget>`, in its own shadow
 * root, without the launcher. `--helpdesk-page-height` sets its height.
 */
export function defineHelpdeskConversations(tag = 'helpdesk-conversations') {
  defineHelpdeskWidget(tag, { inline: true });
}
