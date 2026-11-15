import { forwardRef, type CSSProperties, type HTMLAttributes } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SHIFT_SPRING } from './spring';

export interface TileData {
  /** Stable per letter position in the target word, so repeated letters stay distinct tiles. */
  id: string;
  letter: string;
}

type FaceProps = HTMLAttributes<HTMLDivElement> & {
  letter: string;
  variant?: 'slot' | 'overlay';
};

/** The visible keycap. Used both in the row and as the floating drag overlay. */
export const TileFace = forwardRef<HTMLDivElement, FaceProps>(function TileFace(
  { letter, variant = 'slot', className = '', ...rest },
  ref,
) {
  return (
    <div ref={ref} className={`mc-tile mc-tile--${variant} ${className}`} {...rest}>
      <span className="mc-tile__letter">{letter}</span>
    </div>
  );
});

interface SortableTileProps {
  tile: TileData;
  index: number;
  inPlace: boolean;
  locked: boolean;
  solved: boolean;
}

export function SortableTile({ tile, index, inPlace, locked, solved }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tile.id,
    disabled: locked,
    transition: { duration: SHIFT_SPRING.duration, easing: SHIFT_SPRING.easing },
  });

  const style: CSSProperties & Record<'--i', number> = {
    // Translate only: scaling a sortable item to its neighbour's rect would squash letters.
    transform: CSS.Translate.toString(transform),
    transition,
    '--i': index,
  };

  const classes = [
    isDragging && 'is-placeholder',
    inPlace && !solved && 'is-in-place',
    solved && 'is-locked',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <TileFace
      ref={setNodeRef}
      letter={tile.letter}
      className={classes}
      style={style}
      aria-label={`Letter ${tile.letter}, position ${index + 1}`}
      {...attributes}
      {...listeners}
    />
  );
}
