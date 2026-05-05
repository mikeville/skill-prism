import { useEffect, useState } from 'react';

type Props = {
  markdown: string;
  open: boolean;
  onClose: () => void;
};

export function SkillSidebar({ markdown, open, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      console.warn('clipboard write failed; markdown follows');
      console.log(markdown);
    }
  };

  return (
    <aside
      aria-hidden={!open}
      className={[
        'shrink-0 overflow-hidden bg-paper text-ink flex flex-col',
        'transition-[width,border-left-width] duration-zoom ease-zoom',
        open
          ? 'w-full md:w-[40%] md:min-w-[420px] border-l border-cell border-line'
          : 'w-0 border-l-0',
      ].join(' ')}
    >
      <div className="flex items-center px-8 h-[62px] border-b border-line shrink-0">
        <span className="text-secondary font-secondary">Skill draft</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close skill draft"
          className="ml-auto w-11 h-11 -mr-2 flex items-center justify-center text-ink hover:opacity-60 transition-opacity duration-hover"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 font-mono text-tertiary whitespace-pre-wrap">
        {markdown}
      </div>

      <div className="border-t border-line shrink-0 px-8 py-3 flex justify-end">
        <button
          type="button"
          onClick={handleCopy}
          className="text-secondary font-secondary text-ink hover:opacity-60 transition-opacity duration-hover"
        >
          {copied ? 'Copied' : 'Copy SKILL.md'}
        </button>
      </div>
    </aside>
  );
}
