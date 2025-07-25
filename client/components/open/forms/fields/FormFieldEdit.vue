<template>
  <div>
    <div class="p-2 border-b sticky top-0 z-10 bg-white">
      <UButton
        v-if="!field"
        size="sm"
        color="neutral"
        icon="i-heroicons-x-mark-20-solid"
        variant="ghost"
        @click="closeSidebar"
      />
      <template v-else>
        <div class="flex">
          <UButton
            size="sm"
            color="neutral"
            icon="i-heroicons-x-mark-20-solid"
            variant="ghost"
            @click="closeSidebar"
          />
          <div class="ml-2 flex flex-grow items-center space-between min-w-0 gap-x-3">
            <div class="flex-grow" />
            <BlockTypeIcon
              :type="field.type"
            />

            <p
              v-if="blocksTypes[field.type]"
              class="text-sm text-neutral-500"
            >
              {{ blocksTypes[field.type].title }}
            </p>
            
            <UDropdownMenu
              :items="dropdownItems"
              :popper="{ placement: 'bottom-start' }"
            >
              <UButton
                color="neutral"
                variant="outline"
                icon="i-heroicons-ellipsis-vertical"
              />
            </UDropdownMenu>
          </div>
        </div>
      </template>
    </div>

    <template v-if="field">
      <div class="bg-neutral-100 border-b">
        <UTabs
          v-model="activeTab"
          :items="tabItems"
          color="primary"
          :content="false"
          class="w-full"
        />
      </div>
      <div v-if="activeTab === 'options'">
        <FieldOptions
          v-if="!isBlockField"
          :form="form"
          :field="field"
        />
        <BlockOptions
          v-else
          :form="form"
          :field="field"
        />
      </div>
      <div v-else-if="activeTab === 'logic'">
        <FormBlockLogicEditor
          class="py-2 px-4"
          :form="form"
          :field="field"
        />
      </div>
      <div v-else-if="activeTab === 'validation'">
        <custom-field-validation
          class="py-2 px-4"
          :form="form"
          :field="field"
        />
      </div>
    </template>
    <div
      v-else
      class="text-center p-10 text-sm text-neutral-500"
    >
      Click on field to edit it.
    </div>
  </div>
</template>


<script setup>
import { storeToRefs } from 'pinia'
import clonedeep from 'clone-deep'
import FieldOptions from './components/FieldOptions.vue'
import BlockOptions from './components/BlockOptions.vue'
import BlockTypeIcon from '../components/BlockTypeIcon.vue'
import blocksTypes from '~/data/blocks_types.json'
import FormBlockLogicEditor from '../components/form-logic-components/FormBlockLogicEditor.vue'
import CustomFieldValidation from '../components/CustomFieldValidation.vue'
import { generateUUID } from '~/lib/utils'

const workingFormStore = useWorkingFormStore()
const { content: form } = storeToRefs(workingFormStore)

const selectedFieldIndex = computed(() => workingFormStore.selectedFieldIndex)

const field = computed(() => {
  return form.value && selectedFieldIndex.value !== null
    ? form.value.properties[selectedFieldIndex.value]
    : null
})

// Only set the page once when the component is mounted
// This prevents page jumps when editing field properties
onMounted(() => {
  if (selectedFieldIndex.value !== null) {
    if (workingFormStore.structureService) {
      workingFormStore.structureService.setPageForField(selectedFieldIndex.value)
    }
  }
})

const isBlockField = computed(() => {
  return field.value && field.value.type.startsWith('nf')
})

const typeCanBeChanged = computed(() => {
  return [
    "text",
    "email",
    "phone_number",
    "number",
    "select",
    "multi_select",
    "rating",
    "scale",
    "slider",
  ].includes(field.value.type)
})

// Composable for field type changing logic
const useFieldTypeChange = () => {

  const onChangeType = (newType) => {
    if (["select", "multi_select"].includes(field.value.type)) {
      field.value[newType] = field.value[field.value.type] // Set new options with new type
      delete field.value[field.value.type] // remove old type options
    }
    field.value.type = newType
  }

  const getChangeTypeOptions = (currentType) => {
    let newTypes = []
    
    if ([
      "text",
      "email", 
      "phone_number",
      "number",
      "slider",
      "rating",
      "scale",
    ].includes(currentType)) {
      newTypes = [
        { name: "Text Input", value: "text", icon: "i-heroicons-pencil-20-solid" },
        { name: "Email Input", value: "email", icon: "i-heroicons-at-symbol-20-solid" },
        { name: "Phone Input", value: "phone_number", icon: "i-heroicons-phone-20-solid" },
        { name: "Number Input", value: "number", icon: "i-heroicons-hashtag-20-solid" },
        { name: "Slider Input", value: "slider", icon: "i-heroicons-adjustments-horizontal-20-solid" },
        { name: "Rating Input", value: "rating", icon: "i-heroicons-star-20-solid" },
        { name: "Scale Input", value: "scale", icon: "i-heroicons-chart-bar-20-solid" },
      ]
    }
    
    if (["select", "multi_select"].includes(currentType)) {
      newTypes = [
        { name: "Select Input", value: "select", icon: "i-heroicons-chevron-down-20-solid" },
        { name: "Multi-Select Input", value: "multi_select", icon: "i-heroicons-check-20-solid" },
      ]
    }
    
    return newTypes
      .filter((item) => item.value !== currentType)
      .map((item) => ({
        label: item.name,
        value: item.value,
        icon: item.icon,
        onClick: () => onChangeType(item.value)
      }))
  }

  return {
    getChangeTypeOptions
  }
}

const { getChangeTypeOptions } = useFieldTypeChange()

function removeBlock() {
  workingFormStore.removeField(field.value)
}

function closeSidebar() {
  // Explicitly clear the selected field index to prevent issues with subsequent block additions
  workingFormStore.selectedFieldIndex = null
  workingFormStore.closeEditFieldSidebar()
}

const dropdownItems = computed(() => {
  const baseItems = [
    [{
      label: 'Copy field ID',
      icon: 'i-heroicons-clipboard-20-solid',
      onClick: () => {
        navigator.clipboard.writeText(field.value.id)
        useAlert().success('Field ID copied to clipboard')
      }
    }],
    [{
      label: 'Duplicate',
      icon: 'i-heroicons-document-duplicate-20-solid',
      onClick: () => {
        const newField = clonedeep(field.value)
        newField.id = generateUUID()
        newField.name = 'Copy of ' + newField.name
        const newFields = [...form.value.properties]
        newFields.splice(selectedFieldIndex.value + 1, 0, newField)
        form.value.properties = newFields
      }
    }]
  ]

  // Add change type option with nested menu if type can be changed
  if (typeCanBeChanged.value && !isBlockField.value) {
    const changeTypeOptions = getChangeTypeOptions(field.value.type)
    if (changeTypeOptions.length > 0) {
      baseItems.push([{
        label: 'Change type',
        icon: 'i-heroicons-arrows-right-left-20-solid',
        children: [changeTypeOptions]
      }])
    }
  }

  // Add remove option
  baseItems.push([{
    label: 'Remove',
    icon: 'i-heroicons-trash-20-solid',
    color: 'error',
    onClick: removeBlock
  }])

  return baseItems
})

const activeTab = ref('options')

const tabItems = computed(() => {
  const commonTabs = [
    { label: 'Options', value: 'options' },
    { label: 'Logic', value: 'logic' },
  ]

  if (isBlockField.value) {
    return commonTabs
  } else {
    return [
      ...commonTabs,
      { label: 'Validation', value: 'validation' },
    ]
  }
})

</script>
