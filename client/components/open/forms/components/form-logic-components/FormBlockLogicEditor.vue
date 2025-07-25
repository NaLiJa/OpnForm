<template>
  <div
    v-if="logic"
    :key="resetKey"
  >
    <p class="text-neutral-400 text-xs mb-3">
      Select a field, add some conditions, and finally add some actions.
    </p>
    <div class="relative flex">
      <UButtonGroup size="xs">
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-heroicons-arrow-down-on-square"
          @click="showCopyFormModal = true"
        >
          Copy from
        </UButton>
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-heroicons-arrow-up-on-square"
          @click="showCopyToModal = true"
        >
          Copy to
        </UButton>
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-mdi-clear-outline"
          @click="clearAll"
        >
          Clear
        </UButton>
      </UButtonGroup>
    </div>

    <h5 class="font-medium text-neutral-700 mt-3">
      1. Conditions
    </h5>
    <condition-editor
      ref="filter-editor"
      v-model="logic.conditions"
      class="mt-1 border-t border rounded-md"
      :form="form"
    />

    <h5 class="font-medium text-neutral-700 mt-3">
      2. Actions
    </h5>
    <p class="text-neutral-500 text-xs mb-3">
      Action(s) triggered when above conditions are true.
    </p>
    <flat-select-input
      :key="resetKey"
      v-model="logic.actions"
      name="actions"
      :multiple="true"
      class="mt-1"
      placeholder="Actions..."
      :options="actionOptions"
      @update:model-value="onActionInput"
    />

    <p class="text-neutral-500 text-xs mb-3">
      Note that hidden fields can never be required.
    </p>

    <UModal
      v-model:open="showCopyFormModal"
      title="Copy logic from another field"
      :description="`Select another field/block to copy its logic and apply it to '${field.name}'.`"
    >
      <template #body>
        <SelectInput
          v-model="copyFrom"
          name="copy_from"
          emit-key="value"
          label="Copy logic from"
          placeholder="Choose a field/block..."
          :options="copyFromOptions"
          :searchable="copyFromOptions && copyFromOptions.options > 5"
        />
      </template>

      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          label="Close"
          @click="showCopyFormModal = false"
        />
        <UButton
          color="primary"
          @click="copyLogic"
          label="Confirm & Copy"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="showCopyToModal"
      title="Copy logic to other fields"
      :description="`Select other fields to copy the logic from '${field.name}' to.`"
    >
      <template #body>
        <SelectInput
          v-model="copyTo"
          name="copy_to"
          emit-key="value"
          label="Copy logic to"
          placeholder="Choose fields..."
          :options="copyToOptions"
          :multiple="true"
          :searchable="copyToOptions && copyToOptions.length > 5"
        />
      </template>

      <template #footer>
        <UButton
          color="neutral"
          variant="outline"
          label="Close"
          @click="showCopyToModal = false"
        />
        <UButton
          color="primary"
          @click="copyLogicToFields"
          label="Confirm & Copy"
        />
      </template>
    </UModal>
  </div>
</template>

<script>
import ConditionEditor from "./ConditionEditor.client.vue"
import clonedeep from "clone-deep"
import { default as _has } from "lodash/has"

export default {
  name: "FormBlockLogicEditor",
  components: { ConditionEditor },
  props: {
    field: {
      type: Object,
      required: false,
    },
    form: {
      type: Object,
      required: false,
    },
  },

  data() {
    return {
      resetKey: 0,
      logic: this.field.logic || {
        conditions: null,
        actions: [],
      },
      showCopyFormModal: false,
      copyFrom: null,
      showCopyToModal: false,
      copyTo: [],
    }
  },

  computed: {
    copyFromOptions() {
      return this.form.properties
        .filter((field) => {
          return (
            field.id !== this.field.id &&
            _has(field, "logic") &&
            field.logic !== null &&
            Object.keys(field.logic || {}).length > 0
          )
        })
        .map((field) => {
          return { name: field.name, value: field.id }
        })
    },
    copyToOptions() {
      return this.form.properties
        .filter((field) => {
          return field.id !== this.field.id
        })
        .map((field) => {
          return { name: field.name, value: field.id }
        })
    },
    actionOptions() {
      if (
        [
          "nf-text",
          "nf-code",
          "nf-page-break",
          "nf-divider",
          "nf-image",
        ].includes(this.field.type)
      ) {
        if (this.field.hidden) {
          return [{ name: "Show Block", value: "show-block" }]
        } else {
          return [{ name: "Hide Block", value: "hide-block" }]
        }
      }

      if (this.field.hidden) {
        return [
          { name: "Show Block", value: "show-block" },
          { name: "Require answer", value: "require-answer" },
        ]
      } else if (this.field.disabled) {
        return [
          { name: "Enable Block", value: "enable-block" },
          this.field.required
            ? { name: "Make it optional", value: "make-it-optional" }
            : {
                name: "Require answer",
                value: "require-answer",
              },
        ]
      } else {
        return [
          { name: "Hide Block", value: "hide-block" },
          { name: "Disable Block", value: "disable-block" },
          this.field.required
            ? { name: "Make it optional", value: "make-it-optional" }
            : {
                name: "Require answer",
                value: "require-answer",
              },
        ]
      }
    },
  },

  watch: {
    logic: {
      handler() {
        this.field.logic = this.logic
      },
      deep: true,
    },
    "field.id": {
      handler() {
        // On field change, reset logic
        this.logic = this.field.logic || {
          conditions: null,
          actions: [],
        }
      },
    },
    "field.required": "cleanConditions",
    "field.disabled": "cleanConditions",
    "field.hidden": "cleanConditions",
  },

  mounted() {
    if (!_has(this.field, "logic")) {
      this.field.logic = this.logic
    }
  },

  methods: {
    clearAll() {
      this.logic.conditions = null
      this.logic.actions = []
      this.refreshActions()
    },
    onActionInput() {
      if (this.logic.actions.length >= 2) {
        if (
          this.logic.actions[1] === "require-answer" &&
          this.logic.actions[0] === "hide-block"
        ) {
          this.logic.actions = ["require-answer"]
        } else if (
          this.logic.actions[1] === "hide-block" &&
          this.logic.actions[0] === "require-answer"
        ) {
          this.logic.actions = ["hide-block"]
        }
        this.refreshActions()
      }
    },
    cleanConditions() {
      const availableActions = this.actionOptions.map(function (op) {
        return op.value
      })
      this.logic.actions = availableActions.filter((value) =>
        this.logic.actions.includes(value),
      )
      this.refreshActions()
    },
    refreshActions() {
      this.resetKey++
    },
    copyLogic() {
      if (this.copyFrom) {
        const property = this.form.properties.find((property) => {
          return property.id === this.copyFrom
        })
        if (property && property.logic) {
          this.logic = clonedeep(property.logic)
          this.cleanConditions()
        }
      }
      this.showCopyFormModal = false
    },
    copyLogicToFields() {
      if (this.copyTo.length) {
        this.copyTo.forEach((fieldId) => {
          const targetField = this.form.properties.find(
            (property) => property.id === fieldId
          )
          if (targetField) {
            targetField.logic = clonedeep(this.logic)
          }
        })
      }
      this.showCopyToModal = false
      this.copyTo = []
    },
  },
}
</script>
