import { Module } from '@nestjs/common';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { SharedSupabaseModule } from '../../shared/supabase/supabase.module';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { ResourcesController, TagsController } from './resources.controller';
import { ResourcesService } from './resources.service';
import { StarsController } from './stars.controller';
import { StarsService } from './stars.service';

/**
 * Bundles resources plus their close companions — bookmarks, stars,
 * comments, tags — in one module for this pass, per the current scope.
 * If any of these grow significant independent logic later, split them
 * into their own `src/features/<name>/` modules.
 */
@Module({
  imports: [SharedSupabaseModule, ActivityLogModule],
  controllers: [
    ResourcesController,
    TagsController,
    BookmarksController,
    StarsController,
    CommentsController,
  ],
  providers: [ResourcesService, BookmarksService, StarsService, CommentsService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
