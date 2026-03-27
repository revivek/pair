import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import History from "@tiptap/extension-history";
import Placeholder from "@tiptap/extension-placeholder";

export interface CursorContext {
  surrounding: string; // text around the cursor
}

interface EditorProps {
  onUpdate?: (text: string, cursor: CursorContext) => void;
}

export function Editor({ onUpdate }: EditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpdate = useCallback(
    ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
      if (!editor || !onUpdate) return;

      const text = editor.getText();

      // Debounced persist for HMR survival
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        localStorage.setItem("pair-doc", editor.getHTML());
      }, 1000);

      // Cursor context
      const { from } = editor.state.selection;

      // Get the paragraph text around the cursor
      const $pos = editor.state.doc.resolve(from);
      const parentNode = $pos.parent;
      const surrounding = parentNode.textContent.slice(0, 200);

      onUpdate(text, { surrounding });
    },
    [onUpdate],
  );

  const editor = useEditor({
    content: localStorage.getItem("pair-doc") ?? undefined,
    extensions: [
      Document,
      Paragraph,
      Text,
      History,
      Placeholder.configure({ placeholder: "Start writing..." }),
    ],
    editorProps: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
          view.dispatch(view.state.tr.insertText(text));
          return true;
        }
        return false;
      },
    },
    onUpdate: handleUpdate,
    autofocus: true,
  });

  // Fire onUpdate after mount so orchestrator knows the initial content
  useEffect(() => {
    if (!editor || editor.isDestroyed || !onUpdate) return;
    // Defer so App's useEffect (which creates the orchestrator) runs first
    const timer = setTimeout(() => {
      const text = editor.getText();
      if (text.trim()) {
        const { from } = editor.state.selection;
        const $pos = editor.state.doc.resolve(from);
        onUpdate(text, { surrounding: $pos.parent.textContent.slice(0, 200) });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [editor, onUpdate]);

  const handleWrapperClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== wrapperRef.current && (e.target as HTMLElement).closest(".ProseMirror")) return;
      editor?.commands.focus("end");
    },
    [editor],
  );

  useEffect(() => {
    const handleFocus = () => {
      if (editor && !editor.isDestroyed) {
        editor.commands.focus();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [editor]);

  return (
    <div
      ref={wrapperRef}
      className="min-h-screen cursor-text pt-[18vh] pb-[50vh]"
      onClick={handleWrapperClick}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
