<template>
  <div class="flex flex-wrap px-4 py-1 -ml-1 -mt-1">
    <select-input
      ref="ruleSelect"
      v-model="selectedRule"
      class="flex-grow ml-1 mr-1 mt-1"
      wrapper-class="relative"
      placeholder="Add condition on input field"
      :options="groupCtrl.rules"
      margin-bottom=""
      :searchable="groupCtrl.rules.length > 5"
      emit-key="identifier"
      option-key="identifier"
      name="group-control-slot-rule"
    />
    <UButton
      class="ml-1 mt-1"
      color="neutral"
      variant="outline"
      size="sm"
      :disabled="selectedRule === '' ? true : null"
      @click="addRule"
      label="Add Condition"
    />
    <UButton
      class="ml-1 mt-1"
      variant="outline"
      color="neutral"
      size="sm"
      @click="groupCtrl.newGroup"
      label="Add Group"
    />
  </div>
</template>

<script>
export default {
  components: {},
  props: { groupCtrl: { type: Object, required: true } },
  data() {
    return {
      selectedRule: null,
    }
  },
  methods: {
    addRule() {
      if (this.selectedRule) {
        this.groupCtrl.addRule(this.selectedRule)
        this.$refs.ruleSelect.content = null
        this.selectedRule = null
      } else {
        useAlert().error('Please select a field to add condition on.')
      }
    },
  },
}
</script>
