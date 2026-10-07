import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { Callout } from 'fumadocs-ui/components/callout';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ComponentProps } from 'react';

import { StringTable } from './strings';

/** Fumadocs' callout with a hook for docs.css: its kind sets the tint. */
function DocsCallout({ className, ...props }: ComponentProps<typeof Callout>) {
  return (
    <Callout
      {...props}
      data-type={props.type ?? 'info'}
      className={className ? `bh-callout ${className}` : 'bh-callout'}
    />
  );
}

/** Fumadocs' type table inside a hook for docs.css, which it has no prop for. */
function DocsTypeTable(props: ComponentProps<typeof TypeTable>) {
  return (
    <div className="bh-typetable">
      <TypeTable {...props} />
    </div>
  );
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Callout: DocsCallout,
    Step,
    Steps,
    StringTable,
    Tab,
    Tabs,
    TypeTable: DocsTypeTable,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
