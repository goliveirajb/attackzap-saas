import { Injectable, Logger } from "@nestjs/common";
import { Subject, Observable, merge, interval } from "rxjs";
import { map, filter } from "rxjs/operators";

export interface CrmEvent {
	userId: number;
	type: "new_message" | "contact_updated";
	data: any;
}

@Injectable()
export class CrmEventsService {
	private readonly logger = new Logger(CrmEventsService.name);
	private readonly events$ = new Subject<CrmEvent>();

	emit(event: CrmEvent) {
		this.logger.log(`Event: ${event.type} for user ${event.userId}`);
		this.events$.next(event);
	}

	subscribe(userId: number): Observable<MessageEvent> {
		// Merge real events with heartbeat every 15s to keep connection alive
		const heartbeat$ = interval(15000).pipe(
			map(() => ({ data: { type: "heartbeat" } }) as MessageEvent),
		);

		const events$ = this.events$.pipe(
			filter((e) => e.userId === userId),
			map((e) => ({ data: { type: e.type, ...e.data } }) as MessageEvent),
		);

		return merge(events$, heartbeat$);
	}
}
