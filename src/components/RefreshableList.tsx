import { useCallback } from 'react';
import { FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import type { FlatListProps, ListRenderItem } from 'react-native';
import { useTheme } from '../theme';
import EmptyState from './EmptyState';
import AnimatedListItem from './AnimatedListItem';

interface RefreshableListProps<T> extends Omit<FlatListProps<T>, 'data'> {
  data: T[];
  loading: boolean;
  onRefresh: () => void;
  emptyTitle: string;
  emptySubtitle?: string;
}

export default function RefreshableList<T>({
  data,
  loading,
  onRefresh,
  emptyTitle,
  emptySubtitle,
  ListEmptyComponent,
  renderItem,
  ...props
}: RefreshableListProps<T>) {
  const { colors } = useTheme();
  const animatedRenderItem: ListRenderItem<T> = useCallback(
    (info) => (
      <AnimatedListItem index={info.index}>
        {renderItem?.(info)}
      </AnimatedListItem>
    ),
    [renderItem]
  );

  return (
    <FlatList
      data={data}
      renderItem={animatedRenderItem}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.card}
        />
      }
      ListEmptyComponent={
        ListEmptyComponent ??
        (loading ? (
          <ActivityIndicator
            color={colors.accent}
            size="large"
            style={{ marginTop: 100 }}
          />
        ) : (
          <EmptyState title={emptyTitle} subtitle={emptySubtitle} />
        ))
      }
      {...props}
    />
  );
}
