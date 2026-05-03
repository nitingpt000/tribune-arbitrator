import { HOW_IT_WORKS } from '@/content/landing';

export function HowItWorks(): React.JSX.Element {
  return (
    <ol className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:gap-5 md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
      {HOW_IT_WORKS.map((step) => (
        <li
          key={step.index}
          className="flex w-[260px] shrink-0 flex-col gap-3 border-t border-border pt-5 md:w-auto md:shrink"
        >
          <span className="font-mono text-[0.78rem] uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-400">
            {step.index} · {step.title.toLowerCase()}
          </span>
          <h3 className="text-[1.02rem] font-medium tracking-tight text-foreground">
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
        </li>
      ))}
    </ol>
  );
}
