import { TRPCError } from "@trpc/server";
import { Button, Input, Tabs } from "@polarnl/polarui-react";
import { redirect, useLoaderData, useRouteLoaderData, useNavigate } from "react-router";
import { DragDropContext, Draggable, Droppable, type DraggableProvided, type DraggableStateSnapshot } from "@hello-pangea/dnd";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { FileText, Grip, Import, Loader2, Plus, Trash, Save, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
function parseSimpleCsv(
  text: string,
  options: { delimiter?: string; skip_empty_lines?: boolean } = {},
): string[][] {
  const delimiter = options.delimiter ?? ",";
  const records: string[][] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    if (options.skip_empty_lines && rawLine.trim() === "") {
      continue;
    }

    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i]!;

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < rawLine.length && rawLine[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    cells.push(current);
    records.push(cells);
  }

  return records;
}
import z from "zod";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import SubjectSelector from "~/components/subject-selector";
import ListDiffView from "~/components/list-diff";
import { listItem, type ListItem } from "~/lib/list";
import { buildListDiff, snapshotFromEditableItems } from "~/lib/list-diff";
import { SubjectNamesArray } from "~/lib/subjectnames";
import { useTRPC } from "~/server/react";

import i18n from "~/i18n";
import { appRouter } from "~/server/main";
import { createCallerFactory, createTRPCContext } from "~/server/trpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Route } from "./+types/[id]";

gsap.registerPlugin(useGSAP);

const editableListDraftSchema = z.object({
  name: z.string(),
  subject: z.enum(SubjectNamesArray),
  items: z.array(listItem),
  savedAt: z.number().optional(),
});

type EditableListDraft = z.infer<typeof editableListDraftSchema>;

function normalizeEditableListDraft(draft: EditableListDraft): EditableListDraft {
  const seenIds = new Set<string>();
  const normalizedItems = draft.items.map((item) => {
    const trimmedId = item.id.trim();
    const nextId = trimmedId === "" ? globalThis.crypto.randomUUID() : trimmedId;

    if (seenIds.has(nextId)) {
      return {
        ...item,
        id: globalThis.crypto.randomUUID(),
      };
    }

    seenIds.add(nextId);

    return {
      ...item,
      id: nextId,
    };
  });

  return {
    ...draft,
    items: normalizedItems.length === 0 ? [{
        id: globalThis.crypto.randomUUID(),
        question: "",
        answer: "",
      }] : normalizedItems,
  };
}

function areEditableListDraftsEquivalent(left: EditableListDraft, right: EditableListDraft) {
  return left.name === right.name
    && left.subject === right.subject
    && left.items.length === right.items.length
    && left.items.every((leftItem, index) => {
      const rightItem = right.items[index];

      return leftItem.question === rightItem.question
        && leftItem.answer === rightItem.answer;
    });
}


export async function loader({ params, request }: Route.LoaderArgs) {
  const id = params.id;

  if (!id) {
    throw new Response("Missing list id", { status: 400 });
  }

  const headers = new Headers(request.headers);
  const context = await createTRPCContext({ headers, request });

  const user = context.user;

  if (!user?.id) {
    const url = new URL(request.url);
    return redirect(`/auth/sign-in?next=${encodeURIComponent(`${url.pathname}${url.search}`)}`);
  }

  const caller = createCallerFactory(appRouter)(context);

  try {
    const list = await caller.list.getLatestListData({ listId: id });

    if (
      !(
        list.userId === user.id ||
        list.collaborators.some((collaborator) => collaborator.id === user.id) ||
        user.role === "admin"
      )
    ) {
      throw new Response("FORBIDDEN", { status: 403 });
    }

    return {
      list,
      listId: id,
    };
  } catch (error) {
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') {
      throw new Response("NOT_FOUND", { status: 404 });
    }
    throw error;
  }
}

type LoaderData = Exclude<Awaited<ReturnType<typeof loader>>, Response>

export default function EditListPage() {
  const { list } = useLoaderData<LoaderData>();

  return <EditListEditor key={list.id} list={list} />
}

function EditListEditor({ list }: { list: LoaderData["list"] }) {
  const t = i18n.t;
  const rootData = useRouteLoaderData("root");
  const theme = rootData?.theme ?? "dark";
  const listName = list.name;
  const listSubject = list.subject;
  const initialDraft = useMemo(() => normalizeEditableListDraft({
    name: listName,
    subject: listSubject,
    items: list.items,
  }), [list.items, listName, listSubject]);
  const localDraftStorageKey = `editlist:${list.id}:draft`;
  const [draft, setDraft] = useState<EditableListDraft>(() => initialDraft);
  const [importedDraft, setImportedDraft] = useState<EditableListDraft | null>(null);
  const [isDraftPersistenceReady, setIsDraftPersistenceReady] = useState(false);
  const [removingDraftItemIds, setRemovingDraftItemIds] = useState<string[]>([]);
  const [isSubjectSelectorOpen, setIsSubjectSelectorOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importTab, setImportTab] = useState("text");
  const [importPlainText, setImportPlainText] = useState("");
  const [importCsvText, setImportCsvText] = useState("");
  const [importCsvFileName, setImportCsvFileName] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const itemNodeRefs = useRef(new Map<string, HTMLDivElement>());
  const inputNodeRefs = useRef(new Map<string, HTMLInputElement>());
  const importCsvInputRef = useRef<HTMLInputElement>(null);
  const previousDraftItemIdsRef = useRef(draft.items.map((item) => item.id));
  const trpc = useTRPC();
  const navigate = useNavigate();
  const updateDraftItem = (
    itemId: string,
    updater: (item: ListItem) => ListItem,
  ) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: currentDraft.items.map((item) => (
        item.id === itemId
          ? updater(item)
          : item
      )),
    }));
  };

  const removeDraftItem = (itemId: string) => {
    if (removingDraftItemIds.includes(itemId)) {
      return;
    }

    const node = itemNodeRefs.current.get(itemId);

    if (!node) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        items: currentDraft.items.length === 1
          ? currentDraft.items
          : currentDraft.items.filter((item) => item.id !== itemId),
      }));
      return;
    }

    setRemovingDraftItemIds((currentRemovingItemIds) => [...currentRemovingItemIds, itemId]);
    gsap.killTweensOf(node);

    gsap.to(node, {
      height: 0,
      opacity: 0,
      y: -12,
      scale: 0.98,
      duration: 0.28,
      ease: "power2.in",
      onComplete: () => {
        setDraft((currentDraft) => ({
          ...currentDraft,
          items: currentDraft.items.length === 1
            ? currentDraft.items
            : currentDraft.items.filter((item) => item.id !== itemId),
        }));
        setRemovingDraftItemIds((currentRemovingItemIds) => currentRemovingItemIds.filter((id) => id !== itemId));
        itemNodeRefs.current.delete(itemId);
      },
    });
  };

  const updateListMetaMutation = useMutation({
    ...trpc.list.updateListMeta.mutationOptions(),
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });

  const commitToListMutation = useMutation({
    ...trpc.list.commitToList.mutationOptions(),
    onError: () => {
      toast.error(t("errors.unknown"));
    },
  });

  const itemDiff = useMemo(() => {
    const changes = buildListDiff(
      snapshotFromEditableItems(initialDraft.items),
      snapshotFromEditableItems(draft.items),
    ).changes;

    return { changes };
  }, [draft.items, initialDraft.items]);

  const hasMetaChanges = draft.name !== initialDraft.name || draft.subject !== initialDraft.subject;
  const hasItemChanges = itemDiff.changes.length > 0;
  const isSaving = updateListMetaMutation.isPending || commitToListMutation.isPending;

  useEffect(() => {
    let isCancelled = false;

    void Promise.resolve().then(() => {
      if (isCancelled) {
        return;
      }

      try {
        const rawDraft = window.localStorage.getItem(localDraftStorageKey);

        if (!rawDraft) {
          setIsDraftPersistenceReady(true);
          return;
        }

        const parsedDraft = editableListDraftSchema.safeParse(JSON.parse(rawDraft));

        if (!parsedDraft.success) {
          setIsDraftPersistenceReady(true);
          return;
        }

        const nextImportedDraft = normalizeEditableListDraft(parsedDraft.data);

        if (areEditableListDraftsEquivalent(nextImportedDraft, initialDraft)) {
          setIsDraftPersistenceReady(true);
          return;
        }

        setImportedDraft(nextImportedDraft);
        setIsDraftPersistenceReady(true);
      } catch {
        setIsDraftPersistenceReady(true);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [initialDraft, localDraftStorageKey]);

  useEffect(() => {
    if (!isDraftPersistenceReady) {
      return;
    }

    try {
      if (areEditableListDraftsEquivalent(draft, initialDraft)) {
        window.localStorage.removeItem(localDraftStorageKey);
        return;
      }

      window.localStorage.setItem(localDraftStorageKey, JSON.stringify({
        savedAt: Date.now(),
        ...draft,
      }));
    } catch {
      return;
    }
  }, [draft, initialDraft, isDraftPersistenceReady, localDraftStorageKey]);

  const handleCommit = async () => {
    const nextCommitMessage = commitMessage.trim();

    try {
      if (hasMetaChanges) {
        await updateListMetaMutation.mutateAsync({
          id: list.id,
          ...(draft.name !== initialDraft.name ? { name: draft.name } : {}),
          ...(draft.subject !== initialDraft.subject ? { subject: draft.subject } : {}),
        });
      }

      if (hasItemChanges) {
        await commitToListMutation.mutateAsync({
          id: list.id,
          branch: "main",
          baseCommitId: list.versionData.branches.main.headCommitId,
          commitMessage: nextCommitMessage,
          diff: itemDiff,
        });
      }

      if (!hasMetaChanges && !hasItemChanges) {
        setIsSaveDialogOpen(false);
        setCommitMessage("");
        return;
      }

      setIsSaveDialogOpen(false);
      setCommitMessage("");

      try {
        window.localStorage.removeItem(localDraftStorageKey);
      } catch {
      }

      void navigate(`/app/viewlist/${list.id}`);
    } catch {
      return;
    }
  };

  const appendDraftItem = (focusNewItem: boolean) => {
    const newItem = {
      id: globalThis.crypto.randomUUID(),
      question: "",
      answer: "",
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      items: [...currentDraft.items, newItem],
    }));

    if (focusNewItem) {
      requestAnimationFrame(() => {
        const input = inputNodeRefs.current.get(newItem.id);

        input?.focus();
        input?.select();
      });
    }
  };

  const resetImportDialogState = () => {
    setImportTab("text");
    setImportPlainText("");
    setImportCsvText("");
    setImportCsvFileName(null);

    if (importCsvInputRef.current) {
      importCsvInputRef.current.value = "";
    }
  };

  useGSAP(() => {
    const currentItemIds = draft.items.map((item) => item.id);
    const previousItemIds = new Set(previousDraftItemIdsRef.current);
    const addedItemIds = currentItemIds.filter((itemId) => !previousItemIds.has(itemId));

    previousDraftItemIdsRef.current = currentItemIds;

    for (const itemId of addedItemIds) {
      const node = itemNodeRefs.current.get(itemId);

      if (!node) {
        continue;
      }

      gsap.fromTo(
        node,
        {
          height: 0,
          opacity: 0,
          y: -12,
        },
        {
          height: "auto",
          opacity: 1,
          y: 0,
          duration: 0.28,
          ease: "power2.out",
          clearProps: "height,opacity,transform",
        },
      )
    }
  }, [draft.items.length]);

  return (
    <main className="px-4 py-4 sm:p-6">
      <DraftImportDialog
        open={Boolean(importedDraft)}
        baseDraft={initialDraft}
        importedDraft={importedDraft}
        theme={theme}
        onDiscardLocalDraft={() => {
          try {
            window.localStorage.removeItem(localDraftStorageKey);
          } catch {
            // Ignore storage failures and just continue with the server draft.
          }

          setImportedDraft(null);
          setIsDraftPersistenceReady(true);
        }}
        onApplyLocalDraft={() => {
          if (!importedDraft) {
            return;
          }

          setDraft(normalizeEditableListDraft(importedDraft));
          setImportedDraft(null);
          setIsDraftPersistenceReady(true);
        }}
      />
      <SaveDialog
        open={isSaveDialogOpen}
        theme={theme}
        commitMessage={commitMessage}
        isSaving={isSaving}
        onCommitMessageChange={setCommitMessage}
        onOpenChange={(open) => {
          setIsSaveDialogOpen(open);

          if (!open) {
            setCommitMessage("");
          }
        }}
        onSave={() => { void handleCommit(); }}
      />
      <ImportDialog
        open={isImportDialogOpen}
        theme={theme}
        activeTab={importTab}
        plainTextValue={importPlainText}
        csvFileName={importCsvFileName}
        canImport={importTab === "text" ? importPlainText.trim() !== "" : importCsvText.trim() !== ""}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open);

          if (!open) {
            resetImportDialogState();
          }
        }}
        onActiveTabChange={setImportTab}
        onPlainTextChange={setImportPlainText}
        onCsvFileSelected={(file) => {
          void (async () => {
            if (!file.name.toLowerCase().endsWith(".csv")) {
              toast.error("Alleen CSV-bestanden zijn toegestaan.");

              setImportCsvText("");
              setImportCsvFileName(null);

              if (importCsvInputRef.current) {
                importCsvInputRef.current.value = "";
              }

              return;
            }

            try {
              const content = await file.text();

              setImportCsvText(content);
              setImportCsvFileName(file.name);

              if (importCsvInputRef.current) {
                importCsvInputRef.current.value = "";
              }
            } catch {
              toast.error("CSV-bestand kon niet worden gelezen.");
              setImportCsvText("");
              setImportCsvFileName(null);

              if (importCsvInputRef.current) {
                importCsvInputRef.current.value = "";
              }
            }
          })();
        }}
        onImport={() => {
          try {
            const importedItems: ListItem[] = [];

            if (importTab === "text") {
              let sawNonEmptyLine = false;

              for (const rawLine of importPlainText.split(/\r?\n/)) {
                if (rawLine.trim() === "") {
                  continue;
                }

                sawNonEmptyLine = true;

                const separatorIndex = rawLine.indexOf("=");

                if (separatorIndex < 0) {
                  throw new Error("INVALID_PLAINTEXT_IMPORT");
                }

                const question = rawLine.slice(0, separatorIndex).trim();
                const answer = rawLine.slice(separatorIndex + 1).trim();

                if (question === "") {
                  throw new Error("INVALID_PLAINTEXT_IMPORT");
                }

                importedItems.push({
                  id: globalThis.crypto.randomUUID(),
                  question,
                  answer,
                });
              }

              if (!sawNonEmptyLine) {
                throw new Error("EMPTY_PLAINTEXT_IMPORT");
              }
            } else {
              const records = parseSimpleCsv(importCsvText, {
                delimiter: ",",
                skip_empty_lines: true,
              });

              if (records.length === 0) {
                throw new Error("EMPTY_CSV_IMPORT");
              }

              for (const cells of records) {
                if (cells.length < 2 || cells[0]!.trim() === "") {
                  throw new Error("INVALID_CSV_IMPORT");
                }

                importedItems.push({
                  id: globalThis.crypto.randomUUID(),
                  question: cells[0]!.trim(),
                  answer: cells.slice(1).join(", ").trim(),
                });
              }
            }

            setDraft((currentDraft) => ({
              ...currentDraft,
              items: [...currentDraft.items, ...importedItems],
            }));
            toast.success(`${importedItems.length} items succesvol geïmporteerd`);
            setIsImportDialogOpen(false);
            resetImportDialogState();
          } catch (error) {
            const message = importTab === "text"
              ? error instanceof Error && error.message === "EMPTY_PLAINTEXT_IMPORT"
                ? "Plak eerst een of meer key=value-regels."
                : error instanceof Error && error.message === "INVALID_PLAINTEXT_IMPORT"
                  ? "De geplakte tekst moet regels in het formaat key=value bevatten."
                  : "Importeren van platte tekst is mislukt."
              : error instanceof Error && error.message === "EMPTY_CSV_IMPORT"
                ? "Kies eerst een CSV-bestand."
                : error instanceof Error && error.message === "INVALID_CSV_IMPORT"
                  ? "Het CSV-bestand moet twee kolommen bevatten."
                  : "Importeren van CSV is mislukt.";

            toast.error(message);
          }
        }}
        csvInputRef={importCsvInputRef}
      />
      <div>
        <div className="space-y-3 md:hidden">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <Button
              variant="transparent"
              scheme={theme}
              icon={<X />}
              onClick={() => {
                void navigate(`/app`);
              }}
              className="justify-self-start"
            >
              {t("common.close")}
            </Button>
            <h1 className="pointer-events-none min-w-0 text-center text-2xl font-bold leading-tight">
              {t("lists.edit.title")}
            </h1>
            <div aria-hidden="true" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="transparent"
              scheme={theme}
              icon={<Import />}
              onClick={() => {
                setIsImportDialogOpen(true);
              }}
              className="w-full justify-center"
            >
              Importeren
            </Button>
            <Button
              variant="transparent"
              scheme={theme}
              icon={<Save />}
              onClick={() => {
                setIsSaveDialogOpen(true);
              }}
              className="w-full justify-center"
            >
              {t("lists.edit.save")}
            </Button>
          </div>
        </div>

        <div className="relative hidden flex-row items-center md:flex">
          <Button variant="transparent" scheme={theme} icon={<X />} onClick={() => {
            void navigate(`/app`);
          }}>
            {t("common.close")}
          </Button>
          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-3xl font-bold">
            {t("lists.edit.title")}
          </h1>
          <div className="grow" />
          <Button variant="transparent" scheme={theme} icon={<Import />} onClick={() => {
            setIsImportDialogOpen(true);
          }}>
            Importeren
          </Button>
          <Button variant="transparent" scheme={theme} icon={<Save />} onClick={() => {
            setIsSaveDialogOpen(true);
          }}>
            {t("lists.edit.save")}
          </Button>
        </div>
      </div>
      <div className="mt-4">
        <p className="font-bold">{t("lists.edit.nameLabel")}</p>
        <Input
          scheme={theme}
          value={draft.name}
          onChange={(event) => {
            setDraft((currentDraft) => ({
              ...currentDraft,
              name: event.target.value,
            }));
          }}
          className="mt-2"
          placeholder={t("lists.nameInputPlaceholder")}
        />
        <div className="mt-4">
          <p className="font-bold">{t("home.subject")}</p>
          <SubjectSelector
            selected={draft.subject}
            onSelect={(subjectId) => {
              setDraft((currentDraft) => ({
                ...currentDraft,
                subject: subjectId,
              }));
              setIsSubjectSelectorOpen(false);
            }}
            open={isSubjectSelectorOpen}
            onOpenChange={setIsSubjectSelectorOpen}
          />
        </div>
        <DragDropContext
          onDragEnd={(result) => {
            const { destination, source } = result;

            if (!destination || destination.index === source.index) {
              return;
            }

            setDraft((currentDraft) => {
              const nextItems = [...currentDraft.items];
              const movedItem = nextItems.at(source.index);

              if (movedItem === undefined) {
                return currentDraft;
              }

              nextItems.splice(source.index, 1);
              nextItems.splice(destination.index, 0, movedItem);

              return {
                ...currentDraft,
                items: nextItems,
              };
            });
          }}
        >
          <Droppable droppableId="edit-list-items" direction="vertical">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`mt-4 flex min-h-24 flex-col gap-3 rounded-lg border p-3 transition-colors ${snapshot.isDraggingOver ? "border-sky-500/60 bg-muted/60" : "border-border bg-muted/30"}`}
              >
                {draft.items.map((item, index) => (
                  <Draggable
                    key={item.id}
                    draggableId={item.id}
                    index={index}
                    isDragDisabled={removingDraftItemIds.includes(item.id)}
                  >
                    {(draggableProvided, draggableSnapshot) => (
                      <EditableListItemRow
                        item={item}
                        index={index}
                        totalItems={draft.items.length}
                        theme={theme}
                        isRemoving={removingDraftItemIds.includes(item.id)}
                        provided={draggableProvided}
                        snapshot={draggableSnapshot}
                        onItemUpdate={updateDraftItem}
                        onAppendItem={() => { appendDraftItem(true); }}
                        onRemoveItem={removeDraftItem}
                        itemNodeRefs={itemNodeRefs}
                        inputNodeRefs={inputNodeRefs}
                      />
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
        <Button
          type="button"
          tabIndex={-1}
          onClick={() => {
            appendDraftItem(true);
          }}
          variant="transparent"
          scheme={theme}
          className="mt-4 flex h-24 w-full items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 p-0 transition hover:bg-muted cursor-pointer"
          icon={<Plus className="h-6 w-6" />}
        >
          <span className="text-xl font-semibold">{t("lists.edit.addPair")}</span>
        </Button>
      </div>
    </main>
  )
}

function EditableListItemRow({
  item,
  index,
  totalItems,
  theme,
  isRemoving,
  provided,
  snapshot,
  onItemUpdate,
  onAppendItem,
  onRemoveItem,
  itemNodeRefs,
  inputNodeRefs,
}: {
  item: ListItem;
  index: number;
  totalItems: number;
  theme: "light" | "dark";
  isRemoving: boolean;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  onItemUpdate: (itemId: string, updater: (item: ListItem) => ListItem) => void;
  onAppendItem: () => void;
  onRemoveItem: (itemId: string) => void;
  itemNodeRefs: RefObject<Map<string, HTMLDivElement>>;
  inputNodeRefs: RefObject<Map<string, HTMLInputElement>>;
}) {
  const t = i18n.t;
  const isLastItem = index === totalItems - 1;

  return (
    <div
      ref={(node) => {
        provided.innerRef(node);

        if (node) {
          itemNodeRefs.current.set(item.id, node);
          return;
        }

        itemNodeRefs.current.delete(item.id);
      }}
      {...provided.draggableProps}
      className={`overflow-hidden ${isRemoving ? "pointer-events-none" : ""}`}
    >
      <div
        className={`flex min-h-20 items-start rounded-lg border border-border bg-card px-3 py-3 transition-shadow md:items-center ${snapshot.isDragging ? "shadow-lg ring-1 ring-sky-500/60" : ""}`}
      >
        <p className="flex w-6 shrink-0 justify-center pt-3 font-bold md:pr-2 md:pt-0">
          {index + 1}
        </p>
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
          <Input
            ref={(node) => {
              if (node) {
                inputNodeRefs.current.set(item.id, node);
                return;
              }

              inputNodeRefs.current.delete(item.id);
            }}
            scheme={theme}
            placeholder={t("lists.create.keyInputPlaceholder")}
            value={item.question}
            onChange={(event) => {
              onItemUpdate(item.id, (currentItem) => ({
                ...currentItem,
                question: event.target.value,
              }));
            }}
            className="min-w-0"
          />
          <Input
            scheme={theme}
            placeholder={t("lists.create.valueInputPlaceholder")}
            value={item.answer}
            onChange={(event) => {
              onItemUpdate(item.id, (currentItem) => ({
                ...currentItem,
                answer: event.target.value,
              }));
            }}
            onKeyDown={(event) => {
              if (!isLastItem || event.key !== "Tab" || event.shiftKey) {
                return;
              }

              event.preventDefault();
              onAppendItem();
            }}
            className="min-w-0"
          />
        </div>
        <div className="ml-2 grid shrink-0 grid-cols-1 place-items-center gap-1 self-start md:grid-cols-2 md:self-center">
          <Button
            type="button"
            tabIndex={-1}
            title={t("lists.edit.removeItem")}
            onClick={() => {
              onRemoveItem(item.id);
            }}
            disabled={totalItems === 1 || isRemoving}
            variant="transparent"
            scheme={theme}
            className="flex h-10 w-10 min-h-0 min-w-0 shrink-0 items-center justify-center rounded-md p-0 leading-none text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/15 md:mx-1"
          >
            <span className="flex items-center justify-center leading-none">
              <Trash className="h-5 w-5" tabIndex={-1} />
            </span>
          </Button>
          <Button
            {...(provided.dragHandleProps ?? {})}
            type="button"
            tabIndex={-1}
            variant="transparent"
            scheme={theme}
            className="flex h-10 w-10 min-h-0 min-w-0 shrink-0 cursor-grab items-center justify-center rounded-md p-0 leading-none transition hover:bg-muted active:cursor-grabbing"
          >
            <span className="flex items-center justify-center leading-none">
              <Grip className="h-5 w-5" tabIndex={-1} />
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function SaveDialog({
  open,
  onOpenChange,
  theme,
  commitMessage,
  isSaving,
  onCommitMessageChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: "light" | "dark";
  commitMessage: string;
  isSaving: boolean;
  onCommitMessageChange: (value: string) => void;
  onSave: () => void;
}) {
  const t = i18n.t;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-bold text-xl">{t("lists.edit.almostDone")}</DialogTitle>
          <DialogDescription>
            {t("lists.edit.giveDiffAName")}
          </DialogDescription>
        </DialogHeader>
        <Input
          scheme={theme}
          placeholder={t("lists.edit.giveDiffAName")}
          className="mt-4"
          value={commitMessage}
          onChange={(event) => {
            onCommitMessageChange(event.target.value);
          }}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="transparent" scheme={theme} icon={<X />}>
              {t("navigation.cancel")}
            </Button>
          </DialogClose>
          <Button
            color="sky"
            textColor="white"
            onClick={() => { onSave(); }}
            disabled={isSaving}
            icon={isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          >
            {t("lists.edit.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ImportDialog({
  open,
  onOpenChange,
  theme,
  activeTab,
  onActiveTabChange,
  plainTextValue,
  onPlainTextChange,
  csvFileName,
  csvInputRef,
  onCsvFileSelected,
  canImport,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: "light" | "dark";
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  plainTextValue: string;
  onPlainTextChange: (value: string) => void;
  csvFileName: string | null;
  csvInputRef: RefObject<HTMLInputElement | null>;
  onCsvFileSelected: (file: File) => void;
  canImport: boolean;
  onImport: () => void;
}) {
  const t = i18n.t;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-bold text-xl">Items importeren</DialogTitle>
          <DialogDescription>
            Plak key=value-regels of upload een CSV-bestand met twee kolommen.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          scheme={theme}
          tabs={[
            { value: "text", title: "Platte tekst" },
            { value: "csv", title: "CSV-upload" },
          ]}
          activeTab={activeTab}
          onActiveTabChange={onActiveTabChange}
        />

        {activeTab === "text" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Elke regel moet het formaat <span className="font-mono text-foreground">key=value</span> hebben.
            </p>
            <textarea
              value={plainTextValue}
              onChange={(event) => {
                onPlainTextChange(event.target.value);
              }}
              placeholder={"key=value\na=b"}
              className="min-h-56 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none transition placeholder:text-muted-foreground focus:border-sky-500/60 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className="rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 text-center transition hover:border-sky-500/60 hover:bg-muted/40"
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();

                const csvFile = Array.from(event.dataTransfer.files).find((file) => file.name.toLowerCase().endsWith(".csv"));

                if (!csvFile) {
                  toast.error("Alleen CSV-bestanden zijn toegestaan.");
                  return;
                }

                onCsvFileSelected(csvFile);
              }}
            >
              <input
                ref={csvInputRef}
                id="editlist-import-csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const csvFile = event.target.files?.[0];

                  if (!csvFile) {
                    return;
                  }

                  onCsvFileSelected(csvFile);
                }}
                className="hidden"
              />
              <label
                htmlFor="editlist-import-csv-file"
                className="flex cursor-pointer flex-col items-center gap-2"
              >
                <Upload className="size-8 text-muted-foreground" />
                <span className="font-medium">Klik om een CSV-bestand te kiezen</span>
                <span className="text-sm text-muted-foreground">of sleep het hierheen</span>
                {csvFileName ? (
                  <span className="mt-2 text-xs text-muted-foreground">
                    Geselecteerd bestand: {csvFileName}
                  </span>
                ) : null}
              </label>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              <FileText className="size-4 shrink-0" />
              <span>Een CSV-bestand met twee kolommen, zonder headers, werkt het best.</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="transparent" scheme={theme}>
              {t("navigation.cancel")}
            </Button>
          </DialogClose>
          <Button
            color="sky"
            textColor="white"
            onClick={() => {
              onImport();
            }}
            disabled={!canImport}
            icon={<Import />}
          >
            Importeren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DraftImportDialog({
  open,
  baseDraft,
  importedDraft,
  theme,
  onDiscardLocalDraft,
  onApplyLocalDraft,
}: {
  open: boolean;
  baseDraft: EditableListDraft;
  importedDraft: EditableListDraft | null;
  theme: "light" | "dark";
  onDiscardLocalDraft: () => void;
  onApplyLocalDraft: () => void;
}) {
  const t = i18n.t;
  if (!importedDraft) {
    return null;
  }

  if (importedDraft.savedAt === undefined) {
    return null;
  }

  const savedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(importedDraft.savedAt);
  const baseItems = snapshotFromEditableItems(baseDraft.items);
  const importedItems = snapshotFromEditableItems(importedDraft.items);

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-5xl"
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-bold text-xl">{t("lists.edit.importDraft.title")}</DialogTitle>
          <DialogDescription>
            {t("lists.edit.importDraft.description", { savedAtLabel })}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
          <div className="grid grid-cols-1 border-b border-border bg-muted/40 text-sm text-muted-foreground sm:grid-cols-2">
            <div className="px-4 py-3">{t("lists.edit.importDraft.currentVersion")}</div>
            <div className="px-4 py-3 sm:border-l sm:border-border">{t("lists.edit.importDraft.localDraft")}</div>
          </div>
          <ListDiffView
            items={baseItems}
            commit={{ diff: buildListDiff(baseItems, importedItems) }}
          />
        </div>

        <DialogFooter>
          <Button variant="transparent" scheme={theme} onClick={onDiscardLocalDraft}>
            {t("lists.edit.importDraft.keepServerVersion")}
          </Button>
          <Button color="sky" textColor="white" onClick={onApplyLocalDraft}>
            {t("lists.edit.importDraft.importLocalChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
