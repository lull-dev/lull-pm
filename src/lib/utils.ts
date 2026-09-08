import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type {
	WithElementRef as ToolbeltWithElementRef,
	WithoutChild as ToolbeltWithoutChild,
	WithoutChildren as ToolbeltWithoutChildren,
	WithoutChildrenOrChild as ToolbeltWithoutChildrenOrChild
} from 'svelte-toolbelt';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export type WithElementRef<T, U extends HTMLElement = HTMLElement> = ToolbeltWithElementRef<T, U>;
export type WithoutChild<T> = ToolbeltWithoutChild<T>;
export type WithoutChildren<T> = ToolbeltWithoutChildren<T>;
export type WithoutChildrenOrChild<T> = ToolbeltWithoutChildrenOrChild<T>;
