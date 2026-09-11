<script lang="ts">
	import '../app.css';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarHeader,
		SidebarInset,
		SidebarMenu,
		SidebarMenuButton,
		SidebarMenuItem,
		SidebarProvider,
		SidebarTrigger
	} from '$lib/components/ui/sidebar';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import CalendarDaysIcon from '@lucide/svelte/icons/calendar-days';
	import FolderIcon from '@lucide/svelte/icons/folder';
	import TargetIcon from '@lucide/svelte/icons/target';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import VaultGate from '$lib/components/vault/VaultGate.svelte';
	import VaultBadge from '$lib/components/vault/VaultBadge.svelte';
	import TitleBar from '$lib/components/TitleBar.svelte';
	import { page } from '$app/state';
	import { vaultState } from '$lib/managers/VaultManager.svelte';
	import { taskManager } from '$lib/managers/TaskManager.svelte';
	import { projectManager } from '$lib/managers/ProjectManager.svelte';

	let { children } = $props();

	// A closed or switched vault must not leave the previous one's tasks and projects on screen.
	$effect(() => {
		if (vaultState.status !== 'ready') {
			taskManager.reset();
			projectManager.reset();
		}
	});

	const links = [
		{ href: '/inbox', label: 'Inbox', icon: InboxIcon, ready: true },
		{ href: '/today', label: 'Today', icon: CalendarDaysIcon, ready: true },
		{ href: '/tasks', label: 'Tasks', icon: ListChecksIcon, ready: true },
		{ href: '/projects', label: 'Projects', icon: FolderIcon, ready: true },
		{ href: '/goals', label: 'Goals', icon: TargetIcon, ready: false }
	];
</script>

<div class="flex h-screen flex-col">
	<TitleBar />
	<!-- The sidebar panel is `position: fixed` internally (for its collapse animation), which
	     positions against the viewport unless an ancestor establishes a containing block —
	     `contain: layout` makes this wrapper that ancestor, so `fixed inset-y-0` inside it means
	     "the height of what's left below the title bar" rather than "the whole window". -->
	<SidebarProvider class="min-h-0 flex-1" style="contain: layout;">
		<Sidebar collapsible="icon">
			<SidebarHeader class="relative group-data-[collapsible=icon]:items-center">
				<VaultBadge />
				<SidebarTrigger class="absolute -right-10 top-3" />
			</SidebarHeader>

			<SidebarContent>
				<SidebarMenu class="px-2">
					{#each links as link (link.href)}
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltipContent={link.ready ? link.label : `${link.label} — not built yet`}
								isActive={page.url.pathname.startsWith(link.href)}
							>
								{#snippet child({ props })}
									<a
										{...props}
										href={link.href}
										class="{props.class} {link.ready ? '' : 'opacity-40'}"
									>
										<link.icon />
										<span>{link.label}</span>
									</a>
								{/snippet}
							</SidebarMenuButton>
						</SidebarMenuItem>
					{/each}
				</SidebarMenu>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton tooltipContent="Settings">
							{#snippet child({ props })}
								<a {...props} href="/settings">
									<SettingsIcon />
									<span>Settings</span>
								</a>
							{/snippet}
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>

		<SidebarInset class="min-w-0 overflow-auto">
			<VaultGate>
				{@render children()}
			</VaultGate>
		</SidebarInset>
	</SidebarProvider>
</div>
