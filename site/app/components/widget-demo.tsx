'use client';

import { useState } from 'react';
import { PiMinusBold, PiPlusBold, PiXBold } from 'react-icons/pi';

import { WIDGET } from '../../lib/content';
import { LiveMark } from './live-mark';

type Step = 'home' | 'form' | 'sent';

export function WidgetDemo() {
  const [lang, setLang] = useState<'en' | 'de'>('en');
  const [agent, setAgent] = useState(false);
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<Step>('home');
  const [type, setType] = useState(0);
  const [details, setDetails] = useState(false);
  const [hover, setHover] = useState(false);
  const t = WIDGET[lang];
  const kind = t.types[type] ?? t.types[0];

  return (
    <div className="wdemo">
      <div className="host" aria-hidden="true">
        <div className="host-bar">
          <i />
          <i />
          <i />
          <span>app.harbor.test/billing</span>
        </div>
        <div className="host-body">
          <b>Invoices</b>
          <div className="inv">
            <span>September 2026</span>
            <span>$400.00</span>
            <span className="bad">VAT ID missing</span>
          </div>
          <div className="inv">
            <span>August 2026</span>
            <span>$400.00</span>
            <span>Paid</span>
          </div>
          <div className="inv">
            <span>July 2026</span>
            <span>$400.00</span>
            <span>Paid</span>
          </div>
          <div className="toast">
            1 recent error · TypeError: vatId is undefined
          </div>
        </div>
      </div>
      <div className="wcol">
        <div className="wtoggles">
          <fieldset className="seg">
            <legend className="vh">Who is looking</legend>
            <button
              type="button"
              aria-pressed={!agent}
              onClick={() => setAgent(false)}>
              Visitor
            </button>
            <button
              type="button"
              aria-pressed={agent}
              onClick={() => setAgent(true)}>
              Agent view
            </button>
          </fieldset>
          <fieldset className="seg">
            <legend className="vh">Language</legend>
            <button
              type="button"
              aria-pressed={lang === 'en'}
              onClick={() => setLang('en')}>
              EN
            </button>
            <button
              type="button"
              aria-pressed={lang === 'de'}
              onClick={() => setLang('de')}>
              DE
            </button>
          </fieldset>
        </div>
        {open && (
          <section className="wpanel" aria-label={t.title} aria-live="polite">
            <div className="w-h">
              <b>{t.title}</b>
              <button
                type="button"
                className="w-x"
                aria-label="Close"
                onClick={() => setOpen(false)}>
                <PiXBold aria-hidden="true" />
              </button>
            </div>
            <div className="w-b">
              {agent && (
                <div className="w-agent">
                  <p>{t.waiting(4)}</p>
                  <a className="w-btn" href="#product">
                    {t.openInbox}
                  </a>
                </div>
              )}
              {step === 'home' && (
                <>
                  <p className="w-promise">{t.promise}</p>
                  <div className="w-types">
                    {t.types.map(([name, hint], i) => (
                      <button
                        key={name}
                        type="button"
                        className="w-type"
                        onClick={() => {
                          setType(i);
                          setStep('form');
                        }}>
                        <b>{name}</b>
                        <span>{hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {step === 'form' && kind && (
                <>
                  <button
                    type="button"
                    className="w-back"
                    onClick={() => {
                      setStep('home');
                      setDetails(false);
                    }}>
                    ← {t.back}
                  </button>
                  <label className="w-l" htmlFor="w-msg">
                    {type === 3 ? kind[2] : t.message}
                  </label>
                  <textarea
                    id="w-msg"
                    rows={3}
                    placeholder={kind[2]}
                    defaultValue="The September invoice still shows our old VAT number."
                  />
                  <button
                    type="button"
                    className="w-ctx"
                    aria-expanded={details}
                    onClick={() => setDetails(d => !d)}>
                    {t.context(3)}{' '}
                    {details ? (
                      <PiMinusBold aria-hidden="true" />
                    ) : (
                      <PiPlusBold aria-hidden="true" />
                    )}
                  </button>
                  {details && (
                    <div className="w-ctxl">
                      <small>
                        {t.contextHeading}. {t.contextHint}
                      </small>
                      <label>
                        <input type="checkbox" defaultChecked /> {t.page}{' '}
                        <code>/billing</code>
                      </label>
                      <label>
                        <input type="checkbox" defaultChecked /> {t.viewport}{' '}
                        <code>1440 × 900</code>
                      </label>
                      <label>
                        <input type="checkbox" defaultChecked /> {t.errors}{' '}
                        <code>TypeError: vatId…</code>
                      </label>
                    </div>
                  )}
                  <div className="w-row">
                    <span className="w-shot">{t.screenshot}</span>
                    <button
                      type="button"
                      className="w-btn"
                      onClick={() => setStep('sent')}>
                      {t.send}
                    </button>
                  </div>
                </>
              )}
              {step === 'sent' && kind && (
                <div className="w-sent">
                  <b>{kind[3]}</b>
                  <p>{t.confirm('ACME-1043')}</p>
                  {type === 3 && <span className="w-book">{t.book}</span>}
                  <button
                    type="button"
                    className="w-back"
                    onClick={() => setStep('home')}>
                    ← {t.back}
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
        <button
          className="launch"
          type="button"
          aria-label={
            open ? 'Close the example widget' : 'Open the example widget'
          }
          aria-expanded={open}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
          onClick={() => setOpen(o => !o)}>
          <LiveMark fg="var(--bg)" bg="var(--mint)" wink={hover} />
        </button>
      </div>
    </div>
  );
}
