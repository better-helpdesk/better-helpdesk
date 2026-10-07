import { useEffect, useState } from 'react';

import { useAdmin } from './context';
import {
  type ConversationOption,
  ConversationPicker,
  conversationOption,
} from './pickers';
import { Dialog, useConfirm } from './ui';

export function MergeDialog({
  open,
  onClose,
  onMerged,
  conversationId,
  contactId,
  duplicates,
}: {
  open: boolean;
  onClose: () => void;
  onMerged: () => Promise<void>;
  conversationId: string;
  contactId: string | undefined;
  duplicates: { conversationId: string; reference: string }[];
}) {
  const { api, t } = useAdmin();
  const confirm = useConfirm(t);
  const [suggested, setSuggested] = useState<ConversationOption[]>([]);
  const [failed, setFailed] = useState(false);

  // The AI names duplicates by reference; a search finds their customers.
  const references = duplicates.map(d => d.reference).join(' ');
  useEffect(() => {
    if (!open || !references) return;
    let live = true;
    Promise.all(
      references
        .split(' ')
        .map(reference =>
          api<{ conversations: Parameters<typeof conversationOption>[0][] }>(
            `agent/conversations?q=${encodeURIComponent(reference)}`
          ).then(r =>
            r.conversations
              .map(conversationOption)
              .filter(o => o.reference === reference)
          )
        )
    )
      .then(found => {
        if (live) {
          setSuggested(found.flat().filter(o => o.id !== conversationId));
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, references, api, conversationId]);

  const pick = async (target: ConversationOption) => {
    if (target.id === conversationId) return;
    const { reference } = target;
    const message =
      contactId && target.contactId !== contactId
        ? t('admin.confirmMergeOtherContact', { reference })
        : t('admin.confirmMergeConversation', { reference });
    if (!(await confirm.ask(message, t('admin.mergeAction')))) return;
    setFailed(false);
    try {
      await api(`agent/conversations/${conversationId}/merge`, {
        body: { targetId: target.id },
      });
    } catch {
      setFailed(true);
      return;
    }
    onClose();
    await onMerged();
  };

  return (
    <Dialog open={open} title={t('admin.mergeInto')} onClose={onClose}>
      <div className="sa-dialog-body">
        <h2>{t('admin.mergeInto')}</h2>
        {suggested.length > 0 && (
          <p className="sa-fine">
            {t('admin.duplicates')}:{' '}
            {suggested.map(o => (
              <button
                key={o.id}
                type="button"
                className="sa-btn"
                onClick={() => pick(o)}>
                {o.name}
              </button>
            ))}
          </p>
        )}
        <ConversationPicker label={t('admin.mergeSearch')} onPick={pick} />
        {failed && (
          <p className="sa-error" role="alert">
            {t('admin.mergeFailed')}
          </p>
        )}
        <div className="sa-dialog-foot">
          <button type="button" className="sa-btn" onClick={onClose}>
            {t('admin.cancel')}
          </button>
        </div>
      </div>
      {confirm.node}
    </Dialog>
  );
}
