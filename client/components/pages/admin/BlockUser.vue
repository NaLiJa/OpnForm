<template>
  <AdminCard
    :title="isBlocked ? 'Unblock User' : 'Block User'"
    :icon="isBlocked ? 'heroicons:lock-open-20-solid' : 'heroicons:no-symbol-20-solid'"
  >
    <div class="space-y-6 flex flex-col justify-between">
      <p class="text-xs text-neutral-500">
        <template v-if="isBlocked">
          This will unblock the user and allow them to log in again. Their forms will remain in draft status.
          <br>
          <b>Blocked on:</b> {{ new Date(user.blocked_at).toLocaleString() }}
          <br>
          <b>Reason:</b> {{ lastBlock?.reason }}
        </template>
        <template v-else>
          This will block the user from accessing their account and set all their forms to draft.
        </template>
      </p>

      <VForm @submit.prevent="submit">
        <TextAreaInput
          label="Reason"
          name="reason"
          :form="form"
          :required="true"
          help="Reason will be sent to the user via email."
        />
        <div class="flex space-x-2 mt-4">
          <UButton
            block
            :loading="loading"
            type="submit"
            class="grow"
            :label="isBlocked ? 'Unblock User' : 'Block User'"
          />
          <UButton
            v-if="blockingHistory && blockingHistory.length"
            variant="outline"
            icon="i-heroicons-clock"
            @click="isModalOpen = true"
            label="View History"
          />
        </div>
      </VForm>
    </div>
    <UModal 
      v-model:open="isModalOpen"
      :ui="{ content: 'sm:max-w-4xl' }"
      title="Blocking History"
    >
      <template #body>
        <UTable 
          :columns="historyColumns"
          :data="blockingHistory"
        />
      </template>
    </UModal>
  </AdminCard>
</template>

<script setup>
import { adminApi } from '~/api'

const props = defineProps({
  user: { type: Object, required: true }
})
const emit = defineEmits(['user-updated'])

const alert = useAlert()
const loading = ref(false)
const isModalOpen = ref(false)

const form = useForm({
  user_id: props.user.id,
  reason: ''
})

const historyColumns = [
  {
    accessorKey: 'blocked_at',
    header: 'Blocked At',
    cell: ({ row }) => {
      return row.original.blocked_at ? new Date(row.original.blocked_at).toLocaleString() : ''
    }
  },
  {
    accessorKey: 'blocked_by',
    header: 'Blocked By'
  },
  {
    accessorKey: 'reason',
    header: 'Reason'
  },
  {
    accessorKey: 'unblocked_at',
    header: 'Unblocked At',
    cell: ({ row }) => {
      return row.original.unblocked_at ? new Date(row.original.unblocked_at).toLocaleString() : ''
    }
  },
  {
    accessorKey: 'unblocked_by',
    header: 'Unblocked By'
  },
  {
    accessorKey: 'unblock_reason',
    header: 'Unblock Reason'
  }
]

const isBlocked = computed(() => props.user.is_blocked)
const blockingHistory = computed(() => props.user.meta?.blocking_history || [])
const lastBlock = computed(() => {
  if (!blockingHistory.value.length) {
    return null
  }
  return blockingHistory.value[blockingHistory.value.length - 1]
})


async function submit() {
  loading.value = true
  try {
    let response
    if (isBlocked.value) {
      response = await adminApi.unblockUser(form.data())
    } else {
      response = await adminApi.blockUser(form.data())
    }
    alert.success(response.message)
    emit('user-updated', response.user)
    form.reset()
  } catch (error) {
    alert.error(error.data?.message || 'An error occurred.')
  } finally {
    loading.value = false
  }
}
</script> 