import { deleteLine } from "@/apis/admin.api";
import { queryKeys } from "@/entities/enums/queryKeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useDeleteLine = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, Error, number | string>({
    mutationFn: (id) => deleteLine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeys.LINES] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.ROUTES] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.STATIONS] });
      queryClient.invalidateQueries({ queryKey: [queryKeys.LINE_STATIONS] });
    },
  });
};

export default useDeleteLine;
