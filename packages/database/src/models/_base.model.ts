import { Types } from "mongoose";

export interface BaseMongodbSchema {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
