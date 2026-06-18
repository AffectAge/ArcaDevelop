import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Search } from "lucide-react";
import type { UiTextKey } from "../i18n/uiText";
import { useUiText } from "../i18n/useUiText";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const actions: UiTextKey[] = [
  "commandPalette.action.politics",
  "commandPalette.action.budget",
  "commandPalette.action.routes",
  "commandPalette.action.province",
  "commandPalette.action.resolve",
];

export function CommandPalette({ open, onOpenChange }: Props) {
  const { t } = useUiText();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--arc-modal-backdrop)]" />
        <Dialog.Content className="glass panel-border fixed left-1/2 top-1/4 z-50 w-[min(92vw,640px)] -translate-x-1/2 rounded-xl p-2">
          <Command className="w-full">
            <div className="flex items-center gap-2 border-b border-[var(--arc-color-gold-soft)] px-3">
              <Search size={14} className="text-[var(--arc-color-text-muted)]" />
              <Command.Input className="h-11 w-full bg-transparent text-sm text-[var(--arc-color-text)] outline-none placeholder:text-[var(--arc-color-text-muted)]" placeholder={t("commandPalette.placeholder")} />
            </div>
            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="px-2 py-3 text-sm text-[var(--arc-color-text-muted)]">{t("commandPalette.empty")}</Command.Empty>
              <Command.Group heading={t("commandPalette.actions")}>
                {actions.map((key) => (
                  <Command.Item key={key} className="cursor-pointer rounded-md px-2 py-2 text-sm text-[var(--arc-color-text-soft)] data-[selected=true]:bg-[var(--arc-overlay-30)] data-[selected=true]:text-[var(--arc-color-text)]">
                    {t(key)}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
