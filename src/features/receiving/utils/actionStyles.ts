/**
 * actionStyles — Single source of truth for the visual language of
 * receiving line item actions (pending / update / create / skip).
 *
 * All colors come from CSS tokens so dark mode works automatically.
 * Use `ACTION_STYLES[item.action]` everywhere a badge/button is rendered.
 */
import type { ItemAction } from '../types'

export interface ActionStyle {
  /** Past-tense label for status badges ("Updated", "Created") */
  label: string
  /** Present-tense action verb for buttons ("Update", "Create") */
  verb: string
  /** Foreground color (CSS token) */
  color: string
  /** Background color (CSS token, soft variant) */
  bg: string
}

export const ACTION_STYLES: Record<ItemAction, ActionStyle> = {
  pending: {
    label: 'Pending',
    verb: 'Pending',
    color: 'var(--warn)',
    bg: 'var(--warn-soft)',
  },
  update: {
    label: 'Updated',
    verb: 'Update',
    color: 'var(--ok)',
    bg: 'var(--ok-soft)',
  },
  create: {
    label: 'Created',
    verb: 'Create',
    color: 'var(--info)',
    bg: 'var(--info-soft)',
  },
  skip: {
    label: 'Skipped',
    verb: 'Skip',
    color: 'var(--muted)',
    bg: 'var(--panel-2)',
  },
}
