<template>
  <transition @leave="(el, done) => sidebarMotion?.leave(done)">
    <div
      v-if="show"
      ref="sidebar"
      :class="widthClass"
      class="absolute shadow-lg shadow-neutral-800/30 top-0 h-[calc(100vh-53px)] right-0 lg:shadow-none lg:relative bg-white w-full md:w-1/2 lg:w-2/5 border-l overflow-y-scroll  flex-shrink-0 z-30"
    >
      <slot />
    </div>
  </transition>
</template>

<script setup>
import { slideRight, useMotion } from '@vueuse/motion'
import { watch } from 'vue'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  widthClass: {
    type: String,
    default: 'md:max-w-[20rem]',
  },
})

const sidebar = ref(null)
const sidebarMotion = ref(null)
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      nextTick(() => {
        sidebarMotion.value = useMotion(sidebar.value, slideRight)
      })
    }
  },
)
</script>
