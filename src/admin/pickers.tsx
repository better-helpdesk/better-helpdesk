import { useEffect, useState } from 'react';

import { useAdmin } from './context';

type Option = { id: string; name: string | null; email?: string | null };

function Picker({
  label,
  path,
  field,
  onPick,
}: {
  label: string;
  path: string;
  field: 'contacts' | 'companies';
  onPick: (option: Option) => void;
}) {
  const { api } = useAdmin();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(() => {
      api<Record<string, Option[]>>(`${path}?q=${encodeURIComponent(q)}`)
        .then(r => setOptions((r[field] ?? []).slice(0, 8)))
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, api, path, field]);

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
