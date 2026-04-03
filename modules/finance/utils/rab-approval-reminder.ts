interface ReminderEligibilityInput {
  candidateApproverIds: string[]
  approvedUserIds: string[]
  creatorUserId?: string | null
}

interface ReminderCooldownInput {
  now: Date
  lastReminderAt: Date | null
  cooldownMinutes: number
}

export function filterEligibleReminderRecipients(input: ReminderEligibilityInput): string[] {
  const approvedSet = new Set(input.approvedUserIds)

  return input.candidateApproverIds.filter((userId) => {
    if (!userId) {
      return false
    }

    if (approvedSet.has(userId)) {
      return false
    }

    if (input.creatorUserId && userId === input.creatorUserId) {
      return false
    }

    return true
  })
}

export function shouldSendRabReminder(input: ReminderCooldownInput): boolean {
  if (!input.lastReminderAt) {
    return true
  }

  const cooldownMs = input.cooldownMinutes * 60 * 1000
  return input.now.getTime() - input.lastReminderAt.getTime() >= cooldownMs
}
