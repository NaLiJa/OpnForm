import { computed } from 'vue'
import { useTableColumnPreferences } from './useTableColumnPreferences'
import debounce from 'debounce'

// Provides a composable for managing the state of a table component, including column visibility, pinning, sizing, and wrapping.
// It synchronizes table state with user preferences (such as column order and visibility) and supports dynamic updates based on form structure and workspace context.

export function useTableState(form, withActions = false) {
  // Internal preferences helper (hidden from consumers)
  const columnPreferences = useTableColumnPreferences(
    computed(() => form.value?.id || form.value?.slug)
  )

  const { getColumnPreference, setColumnPreference } = columnPreferences

  /* -------------------------------------------------------------------------- */
  /*                               Column config                               */
  /* -------------------------------------------------------------------------- */

  // Computed column configurations (base definition for every column)
  const columnConfigurations = computed(() => {
    try {
      if (!form.value?.properties || !Array.isArray(form.value.properties)) return []

      const baseColumns = form.value.properties
        .filter((field) => {
          return !['nf-text', 'nf-code', 'nf-page-break', 'nf-divider', 'nf-image'].includes(field.type)
        })
        .map(col => {
          const { columns: matrixColumns, ...rest } = col
          return {
            ...rest,
            ...(col.type === 'matrix' && { matrix_columns: matrixColumns }),
            id: col.id,
            accessorKey: col.id,
            header: col.name,
            isRemoved: false,
            enableResizing: true,
            minSize: 100,
            maxSize: 500,
          }
        })

       // Add removed properties
       if (form.value?.removed_properties) {
         form.value.removed_properties.forEach(property => {
           const { columns: matrixColumns, ...rest } = property
           baseColumns.push({
             ...(property.type === 'matrix' ? { ...rest, matrix_columns: matrixColumns } : { ...rest }),
             id: property.id,
             accessorKey: property.id,
             header: property.name,
             isRemoved: true,
             enableResizing: true,
             minSize: 100,
             maxSize: 500,
           })
         })
       }

       // Add created_at column if not present
       if (!baseColumns.find(property => property.id === 'created_at')) {
         baseColumns.push({
           id: 'created_at',
           accessorKey: 'created_at',
           header: 'Created at',
           type: 'date',
           enableResizing: true,
           minSize: 100,
           maxSize: 500,
         })
       }

       return baseColumns
    } catch (error) {
      console.error('Error in columnConfigurations computed:', error)
      return []
    }
  })

  /* -------------------------------------------------------------------------- */
  /*                       Writable computed bridges (reactive)                 */
  /* -------------------------------------------------------------------------- */

  // Column visibility
  const columnVisibility = computed({
    get() {
      // Establish dependency on the entire preferences object
      const prefs = columnPreferences.preferences.value
      const visibility = {}
      const configCols = columnConfigurations.value || []
      configCols.forEach(col => {
        const pref = prefs.columns[col.id] || {}
        // Use preference if set, otherwise default: visible for regular columns, hidden for removed columns
        const visible = pref.visible !== null && pref.visible !== undefined ? pref.visible : !col.isRemoved
        visibility[col.id] = visible
      })
      return visibility
    },
    set(newVisibility) {
      Object.entries(newVisibility).forEach(([columnId, visible]) => {
        const pref = getColumnPreference(columnId)
        const currentVisible = pref.visible !== null && pref.visible !== undefined 
          ? pref.visible 
          : !columnConfigurations.value.find(c => c.id === columnId)?.isRemoved
        if (currentVisible !== visible) {
          setColumnPreference(columnId, { visible })
        }
      })
    }
  })

  // Column pinning
  const columnPinning = computed({
    get() {
      const prefs = columnPreferences.preferences.value
      const pinning = { left: [], right: ['actions'] }
      const configCols = columnConfigurations.value || []
      configCols.forEach(col => {
        const pref = prefs.columns[col.id] || {}
        // Only allow left pinning for regular columns
        if (pref.pinned === 'left') pinning.left.push(col.id)
        // Actions column is always pinned right, other columns cannot be pinned right
      })
      return pinning
    },
    set(newPinning) {
      const { left = [] } = newPinning || {}
      const configCols = columnConfigurations.value || []

      // First, clear pinning for all applicable columns (except actions)
      configCols.forEach(col => {
        if (col.id !== 'actions') setColumnPreference(col.id, { pinned: false })
      })

      // Apply new left pinning only
      left.forEach(id => {
        if (id !== 'actions') setColumnPreference(id, { pinned: 'left' })
      })
      // Note: actions column pinning is handled automatically in the getter
    }
  })

  // Column sizing (table column resize)
  const columnSizing = computed({
    get() {
      const savedSizing = columnPreferences.preferences.value.globalSizing
      if (savedSizing && typeof savedSizing === 'object' && Object.keys(savedSizing).length > 0) {
        // Ensure all columns have a size, fallback to 200 if missing
        const sizing = {}
        for (const col of tableColumns.value) {
          sizing[col.id] = savedSizing[col.id] ?? 200
        }
        return sizing
      }

      // No saved sizing, use default 200 for all columns
      const defaultSizing = {}
      for (const col of tableColumns.value) {
        if (col.id === 'actions') {
          defaultSizing[col.id] = 80
        } else {
          defaultSizing[col.id] = 200
        }
      }
      return defaultSizing
    },
    set(newSizing) {
      columnPreferences.setColumnSizing(newSizing)
    }
  })

  // Debounced resize handler to avoid excessive localStorage writes
  const debouncedSetColumnSizing = debounce((newSizing) => {
    columnPreferences.setColumnSizing(newSizing)
  }, 50) // 150ms debounce

  // Handle individual column resize - simple preference saving
  const handleColumnResize = (columnId, size) => {
    size = Math.min(Math.max(size, 80), 700)
    const currentSizing = columnSizing.value || {}
    const newSizing = {
      ...currentSizing,
      [columnId]: size
    }
    
    // Update the reactive state immediately for smooth UX
    columnSizing.value = newSizing
    
    // Save to preferences with debounce
    debouncedSetColumnSizing(newSizing)
  }



  // Column wrapping (read-only)
  const columnWrapping = computed(() => {
    const prefs = columnPreferences.preferences.value
    const wrapping = {}
    const configCols = columnConfigurations.value || []
    configCols.forEach(col => {
      const pref = prefs.columns[col.id] || {}
      wrapping[col.id] = pref.wrapped ?? false
    })
    return wrapping
  })

  /* -------------------------------------------------------------------------- */
  /*                              Column ordering                               */
  /* -------------------------------------------------------------------------- */

  // Helper function to set a specific column to a specific index
  const setColumnOrder = (columnId, newIndex) => {
    try {
      // Get the current list of VISIBLE column IDs, already in the correct order
      let visibleColumnIds = orderedColumns.value
        .filter(c => columnVisibility.value[c.id] !== false)
        .map(c => c.id)

      // Perform the move on this array
      const currentIndex = visibleColumnIds.indexOf(columnId)
      if (currentIndex > -1) {
        visibleColumnIds.splice(currentIndex, 1)
      }
      visibleColumnIds.splice(newIndex, 0, columnId)

      // Update the preferences based on the new order
      const allColumnIds = columnConfigurations.value.map(c => c.id)
      allColumnIds.forEach(id => {
        const visibleIndex = visibleColumnIds.indexOf(id)
        if (visibleIndex !== -1) {
          // It's visible, set its order
          columnPreferences.setColumnPreference(id, { order: visibleIndex })
        } else {
          // It's hidden, give it a high order number
          columnPreferences.setColumnPreference(id, { order: 9999 })
        }
      })
    } catch (error) {
      console.error('Error in setColumnOrder:', error)
    }
  }

  // Ordered columns for display
  const orderedColumns = computed({
    get() {
      try {
        const prefs = columnPreferences.preferences.value
        const configCols = columnConfigurations.value || []
        const columns = Array.isArray(configCols) ? [...configCols] : []

        // Sort by order preference, then by original position
        columns.sort((a, b) => {
          const prefA = prefs.columns[a.id] || {}
          const prefB = prefs.columns[b.id] || {}

          const orderA = prefA.order ?? 9999
          const orderB = prefB.order ?? 9999

          if (orderA !== orderB) {
            return orderA - orderB
          }

          // Fallback to original order
          return configCols.indexOf(a) - configCols.indexOf(b)
        })

        return columns
      } catch (error) {
        console.error('Error in orderedColumns computed:', error)
        return []
      }
    },
    set(newOrderColumns) {
      // Logic to update column order preferences
      const allColumnIds = (columnConfigurations.value || []).map(c => c.id)
      const newOrderIds = newOrderColumns.map(c => c.id)

      allColumnIds.forEach(id => {
        const order = newOrderIds.indexOf(id)
        if (order !== -1) {
          // If the column is in the new order, set its order
          columnPreferences.setColumnPreference(id, { order })
        } else {
          // If it's not (e.g., it's a hidden column not in the ordered list),
          // assign a high order number to keep it at the end if it becomes visible
          columnPreferences.setColumnPreference(id, { order: 9999 })
        }
      })
    },
  })

  // Final array of columns to be passed to the table component
  const tableColumns = computed(() => {
    try {
      // Ensure we have a valid array to work with  
      const cols = orderedColumns.value && Array.isArray(orderedColumns.value) ? [...orderedColumns.value] : []

      // Add status column if needed
      if (form.value?.is_pro && (form.value.enable_partial_submissions ?? false)) {
        cols.push({
          id: 'status',
          accessorKey: 'status',
          header: 'Status',
          type: 'status',
          enableColumnFilter: true,
          filterFn: 'equals',
          enableResizing: true,
          minSize: 100,
          maxSize: 500,
        })
      }

      // Add actions column if workspace is not readonly
      if (import.meta.client && withActions) {
        cols.push({
          id: 'actions',
          accessorKey: 'actions',
          header: '',
          enableResizing: false,
          size: 80,
          meta: {
            class: {
              th: 'bg-transparent',
              td: 'backdrop-blur-xs bg-white/70'
      }
          }
        })
      }

      return cols ?? []
    } catch (error) {
      console.error('Error in tableColumns computed:', error)
      return []
    }
  })

  /* -------------------------------------------------------------------------- */
  /*                              Helper functions                              */
  /* -------------------------------------------------------------------------- */

  // Toggle column visibility
  const toggleColumnVisibility = (columnId) => {
    const currentVisibility = columnVisibility.value[columnId]
    columnVisibility.value = {
      ...columnVisibility.value,
      [columnId]: !currentVisibility
    }
  }

  // Toggle column wrapping
  const toggleColumnWrapping = (columnId) => {
    setColumnPreference(columnId, { wrapped: !(columnWrapping.value[columnId] || false) })
  }

  // Toggle column pinning
  const toggleColumnPin = (columnId) => {
    const pref = getColumnPreference(columnId) || {}
    
    if (pref.pinned === 'left') {
      // If currently pinned, just unpin it
      setColumnPreference(columnId, { pinned: false })
    } else {
      // If not currently pinned, first unpin all other columns, then pin this one
      const configCols = columnConfigurations.value || []
      
      // Clear all existing pins
      configCols.forEach(col => {
        if (col.id !== 'actions' && col.id !== columnId) {
          setColumnPreference(col.id, { pinned: false })
        }
      })
      
      // Pin the target column and make it visible
      setColumnPreference(columnId, { pinned: 'left', visible: true })
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                              Public API                                   */
  /* -------------------------------------------------------------------------- */

  return {
    // Columns
    tableColumns,
    orderedColumns,
    setColumnOrder,

    // Preferences (writable computeds)
    columnVisibility,
    columnPinning,
    columnWrapping,
    columnSizing,
    
    // Preference helpers (for components)
    getColumnPreference,
    setColumnPreference,
    resetPreferences: columnPreferences.resetPreferences,
    resetColumn: columnPreferences.resetColumn,
    toggleColumnVisibility: toggleColumnVisibility,
    toggleColumnWrapping,
    toggleColumnPin: toggleColumnPin,
    toggleColumnWrap: columnPreferences.toggleColumnWrap,
    setColumnsOrder: columnPreferences.setColumnsOrder,
    handleColumnResize,
  }
} 