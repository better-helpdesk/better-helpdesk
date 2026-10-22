import { useState } from 'react';

import { RichEditor } from '../ui/rich-editor';
import { useAdmin } from './context';
import { ContactPicker } from './pickers';
import { Dialog, Select } from './ui';

type Contact = { id: string; name: string | null; email?: string | null };

/**
 * A conversation the team starts, after a phone call or to reach a customer
 * first. The message is the agent's and goes out by email; the customer
 * answers in the widget or by mail.
 */
export function NewConversationDialog({
  open,
  contact: fixed,
  onClose,
  onCreated,
}: {
  open: boolean;
  /** On a contact's page, the contact is known. */
  contact?: Contact;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { api, t, me, inboxName, priorityName } = useAdmin();
  const [contact, setContact] = useState<Contact | null>(fixed ?? null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [inbox, setInbox] = useState(me.inboxes[0] ?? 'support');
  const [type, setType] = useState(me.types[0] ?? 'question');
  const [priority, setPriority] = useState(me.defaultPriority);
  const [tier, setTier] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const to = fixed ?? contact;
  return (
    <Dialog open={open} title={t('admin.newConversation')} onClose={onClose}>
      <form
        onSubmit={async e => {
          e.preventDefault();
          if (busy || !body.trim()) return;
          setBusy(true);
          setError(false);
          try {
            const { conversation } = await api<{
              conversation: { id: string };
            }>('agent/conversations', {
              body: {
                inbox,
                type,
                priority,
                ...(tier && { tier }),
                subject,
                body,
                ...(to
                  ? { contactId: to.id }
                  : { email, ...(name && { name }) }),
              },
            });
            setSubject('');
            setBody('');
            onCreated(conversation.id);
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}>
        <h2>{t('admin.newConversation')}</h2>
        <p className="sa-muted">{t('admin.newConversationHint')}</p>
        <div className="sa-field">
          {t('admin.toContact')}
          {to ? (
            <span className="sa-toolbar">
              <strong>{to.name ?? to.email}</strong>
              {to.name && to.email && (
                <span className="sa-muted">{to.email}</span>
              )}
              {!fixed && (
                <button
                  type="button"
                  className="sa-btn sa-ghost"
                  onClick={() => setContact(null)}>
                  {t('admin.cancel')}
                </button>
              )}
            </span>
          ) : (
            <>
              <ContactPicker
                label={t('admin.pickContact')}
                onPick={setContact}
              />
              <input
                className="sa-input"
                type="email"
                aria-label={t('admin.newContactEmail')}
                placeholder={t('admin.newContactEmail')}
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <input
                className="sa-input"
                type="text"
                aria-label={t('admin.newContactName')}
                placeholder={t('admin.newContactName')}
                maxLength={200}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </>
          )}
        </div>
        <div className="sa-toolbar">
          <Select
            label={t('admin.inboxLabel')}
            value={inbox}
            options={me.inboxes}
            render={inboxName}
            onChange={setInbox}
          />
          <Select
            label={t('admin.type')}
            value={type}
            options={me.types}
            render={v => t(`agentType.${v}`)}
            onChange={setType}
          />
          <Select
            label={t('admin.priority')}
            value={priority}
            options={me.priorities}
            render={priorityName}
            onChange={setPriority}
          />
          {me.tiers.length > 0 && (
            <Select
              label={t('admin.tier')}
              value={tier}
              options={['', ...me.tiers]}
              render={v => v || t('admin.noTier')}
              onChange={setTier}
            />
          )}
        </div>
        <label className="sa-field">
          {t('form.subject')}
          <input
            className="sa-input"
            required
            maxLength={200}
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />
        </label>
        <div className="sa-field">
          <span aria-hidden="true">{t('admin.message')}</span>
          <RichEditor
            className="rt-dialog"
            label={t('admin.message')}
            value={body}
            onChange={setBody}
            t={t}
          />
        </div>
        {error && (
          <p className="sa-error" role="alert">
            {t('admin.error')}
          </p>
        )}
        <div className="sa-dialog-foot">
          <button type="button" className="sa-btn" onClick={onClose}>
            {t('admin.cancel')}
          </button>
          <button type="submit" className="sa-btn sa-primary" disabled={busy}>
            {busy ? t('admin.sending') : t('admin.startConversation')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
