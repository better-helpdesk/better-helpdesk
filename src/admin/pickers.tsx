import { useEffect, useState } from 'react';

import { useAdmin } from './context';

type Option = { id: string; name: string | null; email?: string | null };

export type ConversationOption = Option & {
  reference: string;
  contactId: string;
};

type ConversationRow = {
  id: string;
  reference: string;
  subject: string | null;
  contact: { id: string; name: string | null; email: string | null };
};

export const conversationOption = (c: ConversationRow): ConversationOption => ({
  id: c.id,
  name: [c.reference, c.subject].filter(Boolean).join(' '),
  email: c.contact.name ?? c.contact.email,
  reference: c.reference,
  contactId: c.contact.id,
});

// Module-level so the search effect's dependencies stay stable.
const asOption = (row: never) => row;

function Picker<T extends Option>({
  label,
  path,
  field,
  onPick,
  toOption = asOption as (row: never) => T,
}: {
  label: string;
  path: string;
  field: 'contacts' | 'companies' | 'conversations';
  onPick: (option: T) => void;
  toOption?: (row: never) => T;
}) {
  const { api } = useAdmin();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<T[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      api<Record<string, never[]>>(`${path}?q=${encodeURIComponent(q)}`)
        .then(r => setOptions((r[field] ?? []).slice(0, 8).map(toOption)))
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, api, path, field, toOption]);

  return (
    <div>
      <input
        type="search"
        className="sa-input"
        aria-label={label}
        placeholder={label}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          className="sa-btn"
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            marginTop: 4,
          }}
          onClick={() => {
            onPick(o);
            setQuery('');
          }}>
          {o.name ?? o.email}
          {o.email && o.name ? (
            <span className="sa-muted"> {o.email}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export const ContactPicker = (props: {
  label: string;
  onPick: (o: Option) => void;
}) => <Picker {...props} path="agent/contacts" field="contacts" />;

export const CompanyPicker = (props: {
  label: string;
  onPick: (o: Option) => void;
}) => <Picker {...props} path="agent/companies" field="companies" />;

export const ConversationPicker = (props: {
  label: string;
  onPick: (o: ConversationOption) => void;
}) => (
  <Picker
    {...props}
    path="agent/conversations"
    field="conversations"
    toOption={conversationOption}
  />
);
