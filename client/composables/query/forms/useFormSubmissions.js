import { useQueryClient, useQuery, useMutation } from '@tanstack/vue-query'
import { formsApi } from '~/api/forms'

export function useFormSubmissions() {
  const queryClient = useQueryClient()

  const submissions = (formId, options = {}) => {
    return useQuery({
      queryKey: ['forms', formId, 'submissions', options.filters],
      queryFn: () => formsApi.submissions.list(formId, options),
      enabled: !!formId,
      onSuccess: (data) => {
        data?.forEach(submission => {
          queryClient.setQueryData(['submissions', submission.id], submission)
        })
      },
      ...options
    })
  }

  const paginatedSubmissions = (formId, page = ref(1), filters = ref({}), options = {}) => {
    return useQuery({
      queryKey: ['forms', formId, 'submissions', { page: page.value, ...filters.value }],
      queryFn: () => formsApi.submissions.list(formId, { page: page.value, ...filters.value }),
      enabled: !!formId,
      keepPreviousData: true,
      onSuccess: (data) => {
        data?.data?.forEach(submission => {
          queryClient.setQueryData(['submissions', submission.id], submission)
        })
      },
      ...options
    })
  }

  const submissionDetail = (slug, submissionId, options = {}) => {
    return useQuery({
      queryKey: ['submissions', submissionId],
      queryFn: () => formsApi.submissions.get(slug, submissionId, options),
      enabled: !!(slug && submissionId),
      ...options
    })
  }

  const updateSubmission = (options = {}) => {
    return useMutation({
      mutationFn: ({ formId, submissionId, data }) => formsApi.submissions.update(formId, submissionId, data),
      onSuccess: (updatedSubmission, { formId, submissionId }) => {
      // Update submission cache
      queryClient.setQueryData(['submissions', submissionId], updatedSubmission)
      
      // Update in submissions list
      queryClient.setQueryData(['forms', formId, 'submissions'], (old) => {
        if (!old) return old
        if (Array.isArray(old)) {
          return old.map(submission => 
            submission.id === submissionId ? { ...submission, ...updatedSubmission } : submission
          )
        }
        if (old.data) {
          return {
            ...old,
            data: old.data.map(submission => 
              submission.id === submissionId ? { ...submission, ...updatedSubmission } : submission
            )
          }
        }
        return old
      })
      },
      ...options
    })
  }

  const deleteSubmission = (options = {}) => {
    return useMutation({
      mutationFn: ({ formId, submissionId }) => formsApi.submissions.delete(formId, submissionId),
      onSuccess: (_, { formId, submissionId }) => {
      // Remove from submission cache
      queryClient.removeQueries({ queryKey: ['submissions', submissionId] })
      
      // Remove from submissions list
      queryClient.setQueryData(['forms', formId, 'submissions'], (old) => {
        if (!old) return old
        if (Array.isArray(old)) {
          return old.filter(submission => submission.id !== submissionId)
        }
        if (old.data) {
          return {
            ...old,
            data: old.data.filter(submission => submission.id !== submissionId)
          }
        }
        return old
      })
      
      // Invalidate stats
      queryClient.invalidateQueries(['forms', formId, 'stats'])
      },
      ...options
    })
  }

  const exportSubmissions = (options = {}) => {
    return useMutation({
      mutationFn: ({ formId, data }) => formsApi.submissions.export(formId, data),
      ...options
    })
  }

  const invalidateSubmissions = (formId) => {
    queryClient.invalidateQueries(['forms', formId, 'submissions'])
  }

  return {
    submissions,
    paginatedSubmissions,
    submissionDetail,
    updateSubmission,
    deleteSubmission,
    exportSubmissions,
    invalidateSubmissions,
  }
} 