<script lang="ts">
	import { taskManager, taskState } from '$lib/managers/TaskManager.svelte';
	import { vaultManager } from '$lib/managers/VaultManager.svelte';
	import {
		Sheet,
		SheetContent,
		SheetHeader,
		SheetTitle,
		SheetDescription
	} from '$lib/components/ui/sheet';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import ExternalLinkIcon from '@lucide/svelte/icons/external-link';
	import {
		TASK_PRIORITIES,
		TASK_STATUSES,
		type TaskPriority,
		type TaskStatus
	} from '$lib/models/Task';

	interface Props {
		open: boolean;
		path: string | null;
	}

	let { open = $bindable(), path }: Props = $props();

	const task = $derived(path ? (taskState.tasks.find((t) => t.path === path) ?? null) : null);

	let newStep = $state('');

	function addStep(event: Event) {
		event.preventDefault();
		if (!path || newStep.trim() === '') return;
		void taskManager.addStep(path, newStep.trim());
		newStep = '';
	}

	function commitList(current: string[], next: string, apply: (values: string[]) => void) {
		const values = next
			.split(',')
			.map((v) => v.trim())
			.filter((v) => v !== '');
		if (values.join(',') === current.join(',')) return;
		apply(values);
	}
</script>

<Sheet bind:open>
	<SheetContent class="flex flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
		{#if task}
			{@const currentPath = task.path}
			<SheetHeader class="border-b">
				<SheetTitle>{task.name}</SheetTitle>
				<SheetDescription>
					<button
						type="button"
						class="inline-flex items-center gap-1 font-mono text-xs hover:text-foreground"
						onclick={() => vaultManager.openInObsidian(currentPath)}
					>
						<ExternalLinkIcon class="size-3" />
						{currentPath}
					</button>
				</SheetDescription>
			</SheetHeader>

			<div class="flex flex-col gap-6 p-4">
				<div class="flex gap-3">
					<div class="flex-1">
						<label class="mb-1 block text-xs text-muted-foreground" for="task-status">Status</label>
						<Select
							type="single"
							value={task.status}
							onValueChange={(value) =>
								value && taskManager.setStatus(currentPath, value as TaskStatus)}
						>
							<SelectTrigger id="task-status" class="w-full" size="sm">{task.status}</SelectTrigger>
							<SelectContent>
								{#each TASK_STATUSES as status (status)}
									<SelectItem value={status} label={status}>{status}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>

					<div class="flex-1">
						<label class="mb-1 block text-xs text-muted-foreground" for="task-priority"
							>Priority</label
						>
						<Select
							type="single"
							value={task.priority}
							onValueChange={(value) =>
								value && taskManager.setPriority(currentPath, value as TaskPriority)}
						>
							<SelectTrigger id="task-priority" class="w-full" size="sm"
								>{task.priority}</SelectTrigger
							>
							<SelectContent>
								{#each TASK_PRIORITIES as priority (priority)}
									<SelectItem value={priority} label={priority}>{priority}</SelectItem>
								{/each}
							</SelectContent>
						</Select>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs text-muted-foreground" for="task-do">Do date</label>
						<Input
							id="task-do"
							type="date"
							value={task.doDate ?? ''}
							onchange={(e) =>
								taskManager.setDoDate(
									currentPath,
									(e.currentTarget as HTMLInputElement).value || null
								)}
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs text-muted-foreground" for="task-due">Due</label>
						<Input
							id="task-due"
							type="date"
							value={task.due ?? ''}
							onchange={(e) =>
								taskManager.setDue(
									currentPath,
									(e.currentTarget as HTMLInputElement).value || null
								)}
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="mb-1 block text-xs text-muted-foreground" for="task-org">
							Bucket (org)
						</label>
						<Input
							id="task-org"
							value={task.org.join(', ')}
							placeholder="Personal, Work"
							onblur={(e) =>
								commitList(task.org, (e.currentTarget as HTMLInputElement).value, (values) =>
									taskManager.setOrg(currentPath, values)
								)}
						/>
					</div>
					<div>
						<label class="mb-1 block text-xs text-muted-foreground" for="task-projects">
							Projects
						</label>
						<Input
							id="task-projects"
							value={task.projects.join(', ')}
							placeholder="lull.app"
							onblur={(e) =>
								commitList(task.projects, (e.currentTarget as HTMLInputElement).value, (values) =>
									taskManager.setProjects(currentPath, values)
								)}
						/>
					</div>
				</div>

				<div>
					<h3 class="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Why
					</h3>
					<textarea
						class="min-h-16 w-full resize-y rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
						value={task.why}
						onblur={(e) => {
							const text = (e.currentTarget as HTMLTextAreaElement).value;
							if (text !== task.why) void taskManager.setWhy(currentPath, text);
						}}
					></textarea>
				</div>

				<div>
					<h3 class="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Steps
					</h3>
					<div class="flex flex-col gap-1.5">
						{#each task.steps as step, index (index)}
							<label class="flex items-start gap-2 text-sm">
								<input
									type="checkbox"
									class="mt-0.5"
									checked={step.state === 'x'}
									onchange={() => taskManager.toggleStep(currentPath, index)}
								/>
								<span class={step.state === 'x' ? 'text-muted-foreground line-through' : ''}>
									{step.text}
								</span>
							</label>
						{/each}
					</div>
					<form class="mt-2 flex gap-2" onsubmit={addStep}>
						<Input bind:value={newStep} placeholder="Add a step" class="h-8 text-sm" />
						<Button type="submit" size="sm" variant="outline" disabled={newStep.trim() === ''}>
							Add
						</Button>
					</form>
				</div>

				<div>
					<h3 class="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
						Notes
					</h3>
					<textarea
						class="min-h-16 w-full resize-y rounded-md border border-input bg-transparent p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
						value={task.notes}
						onblur={(e) => {
							const text = (e.currentTarget as HTMLTextAreaElement).value;
							if (text !== task.notes) void taskManager.setNotes(currentPath, text);
						}}
					></textarea>
				</div>
			</div>
		{/if}
	</SheetContent>
</Sheet>
