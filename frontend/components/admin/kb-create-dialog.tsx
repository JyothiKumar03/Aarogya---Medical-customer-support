"use client"

import { useState } from "react"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { PlusSignIcon } from "@hugeicons/core-free-icons"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { TagPicker } from "./tag-picker"
import { useCreateKB } from "@/hooks/use-kb"
import type { TKBTag } from "@/lib/tags"

export function KBCreateDialog() {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [tags, setTags] = useState<TKBTag[]>([])
  const create = useCreateKB()

  const reset = () => {
    setTitle("")
    setContent("")
    setTags([])
  }

  const submit = async () => {
    if (!title.trim() || !content.trim() || tags.length === 0) {
      toast.error("Title, content and at least one tag are required.")
      return
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        tags,
      })
      toast.success("KB entry created")
      reset()
      setOpen(false)
    } catch (err) {
      console.error(err)
      toast.error("Couldn't create KB entry.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <HugeiconsIcon icon={PlusSignIcon} size={14} />
          New entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New KB entry</DialogTitle>
          <DialogDescription>
            Manually add a knowledge base article. Embeddings are generated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="kb-title">Title</Label>
            <Input
              id="kb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. What is covered under maternity?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kb-content">Content</Label>
            <Textarea
              id="kb-content"
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Factual, 2–3 sentences. No first-person pronouns."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <TagPicker selected={tags} onChange={setTags} />
            <p className="text-[11px] text-muted-foreground">
              Pick 1–5 from the approved list.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
