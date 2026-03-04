import {
   DeleteOutlined,
   EditOutlined,
   FolderAddOutlined,
   HolderOutlined,
   PlusOutlined,
} from "@ant-design/icons";
import {
   Alert,
   Button,
   Card,
   Collapse,
   Empty,
   Form,
   Input,
   Modal,
   Select,
   Space,
   Tooltip,
   Typography,
} from "antd";
import { useState } from "react";
import {
   DragDropContext,
   Draggable,
   Droppable,
   DropResult,
} from "@hello-pangea/dnd";
import { EnvironmentConfig, EnvironmentGroup } from "../types";
import { storageKeys } from "../utils/localStorage";

type Props = {
   groups: EnvironmentGroup[];
   allEnvironments: EnvironmentConfig[];
   onCreateGroup: (groupName: string) => void;
   onRenameGroup: (groupId: string, groupName: string) => void;
   onDeleteGroup: (groupId: string) => void;
   onAdd: (groupId: string, environment: Omit<EnvironmentConfig, "id">) => void;
   onEdit: (
      groupId: string,
      environment: EnvironmentConfig,
      previousGroupId?: string,
   ) => void;
   onDelete: (id: string) => void;
   onReorderGroups: (sourceIndex: number, destinationIndex: number) => void;
   onReorderEnvironments: (
      sourceGroupId: string,
      destinationGroupId: string,
      sourceIndex: number,
      destinationIndex: number,
   ) => void;
};

type FormValues = {
   groupId: string;
   name: string;
   clientId: string;
   clientSecret: string;
};

type GroupFormValues = {
   groupName: string;
};

export const EnvironmentManager = ({
   groups,
   allEnvironments,
   onCreateGroup,
   onRenameGroup,
   onDeleteGroup,
   onAdd,
   onEdit,
   onDelete,
   onReorderGroups,
   onReorderEnvironments,
}: Props) => {
   const [form] = Form.useForm<FormValues>();
   const [groupForm] = Form.useForm<GroupFormValues>();
   const [isEnvironmentModalOpen, setIsEnvironmentModalOpen] = useState(false);
   const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
   const [editingEnvironment, setEditingEnvironment] =
      useState<EnvironmentConfig | null>(null);
   const [editingEnvironmentGroupId, setEditingEnvironmentGroupId] = useState<
      string | null
   >(null);
   const [editingGroup, setEditingGroup] = useState<EnvironmentGroup | null>(
      null,
   );

   const groupNameExists = (value: string, ignoreGroupId?: string) =>
      groups.some(
         (group) =>
            group.groupName.trim().toLowerCase() ===
               value.trim().toLowerCase() && group.groupId !== ignoreGroupId,
      );

   const environmentNameExists = (
      value: string,
      ignoreEnvironmentId?: string,
   ) =>
      allEnvironments.some(
         (environment) =>
            environment.name.trim().toLowerCase() ===
               value.trim().toLowerCase() &&
            environment.id !== ignoreEnvironmentId,
      );

   const openCreateEnvironment = (groupId?: string) => {
      if (groups.length === 0) {
         return;
      }

      setEditingEnvironment(null);
      setEditingEnvironmentGroupId(null);
      form.resetFields();
      form.setFieldsValue({
         groupId:
            groupId ?? (groups.length === 1 ? groups[0].groupId : undefined),
      });
      setIsEnvironmentModalOpen(true);
   };

   const openEditEnvironment = (
      environment: EnvironmentConfig,
      groupId: string,
   ) => {
      setEditingEnvironment(environment);
      setEditingEnvironmentGroupId(groupId);
      form.setFieldsValue({
         groupId,
         name: environment.name,
         clientId: environment.clientId,
         clientSecret: environment.clientSecret,
      });
      setIsEnvironmentModalOpen(true);
   };

   const openCreateGroup = () => {
      setEditingGroup(null);
      groupForm.resetFields();
      setIsGroupModalOpen(true);
   };

   const openRenameGroup = (group: EnvironmentGroup) => {
      setEditingGroup(group);
      groupForm.setFieldsValue({ groupName: group.groupName });
      setIsGroupModalOpen(true);
   };

   const handleGroupSubmit = async () => {
      const values = await groupForm.validateFields();
      const groupName = values.groupName.trim();

      if (editingGroup) {
         onRenameGroup(editingGroup.groupId, groupName);
      } else {
         onCreateGroup(groupName);
      }

      setIsGroupModalOpen(false);
   };

   const handleEnvironmentSubmit = async () => {
      const values = await form.validateFields();
      const payload = {
         name: values.name.trim(),
         clientId: values.clientId.trim(),
         clientSecret: values.clientSecret,
      };

      if (editingEnvironment && editingEnvironmentGroupId) {
         onEdit(
            values.groupId,
            { ...editingEnvironment, ...payload },
            editingEnvironmentGroupId,
         );
      } else {
         onAdd(values.groupId, payload);
      }

      setIsEnvironmentModalOpen(false);
   };

   const handleDeleteGroup = (group: EnvironmentGroup) => {
      Modal.confirm({
         title: `Delete group \"${group.groupName}\"?`,
         content: "Only empty groups can be deleted.",
         okButtonProps: {
            danger: true,
            disabled: group.environments.length > 0,
         },
         onOk: () => onDeleteGroup(group.groupId),
      });
   };

   const handleDeleteEnvironment = (environment: EnvironmentConfig) => {
      Modal.confirm({
         title: `Delete environment \"${environment.name}\"?`,
         okButtonProps: { danger: true },
         onOk: () => onDelete(environment.id),
      });
   };

   const onDragEnd = (result: DropResult) => {
      if (!result.destination) {
         return;
      }

      if (result.type === "GROUP") {
         if (result.source.index === result.destination.index) {
            return;
         }
         onReorderGroups(result.source.index, result.destination.index);
         return;
      }

      if (
         result.source.droppableId === result.destination.droppableId &&
         result.source.index === result.destination.index
      ) {
         return;
      }

      onReorderEnvironments(
         result.source.droppableId.replace("group-", ""),
         result.destination.droppableId.replace("group-", ""),
         result.source.index,
         result.destination.index,
      );
   };

   return (
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
         <Alert
            type="warning"
            showIcon
            title={`Client secrets are stored as plain text in browser localStorage. Storage key: ${storageKeys.groups}`}
         />

         <Space style={{ width: "100%", justifyContent: "end" }}>
            <Button
               icon={<FolderAddOutlined />}
               onClick={openCreateGroup}
               size="small"
            >
               Create Group
            </Button>
            {/* <Button
               type="primary"
               icon={<PlusOutlined />}
               onClick={() => openCreateEnvironment()}
               disabled={groups.length === 0}
               size="small"
            >
               Add Environment
            </Button> */}
         </Space>

         {groups.length === 0 ? (
            <Card size="small">
               <Empty description="No groups yet. Create your first group to add environments." />
            </Card>
         ) : (
            <DragDropContext onDragEnd={onDragEnd}>
               <Droppable droppableId="groups" type="GROUP">
                  {(groupsProvided) => (
                     <div
                        ref={groupsProvided.innerRef}
                        {...groupsProvided.droppableProps}
                        style={{ width: "100%" }}
                     >
                        <Space
                           orientation="vertical"
                           size="small"
                           style={{ width: "100%" }}
                        >
                           {groups.map((group, groupIndex) => (
                              <Draggable
                                 key={group.groupId}
                                 draggableId={`group-${group.groupId}`}
                                 index={groupIndex}
                              >
                                 {(groupProvided) => (
                                    <div
                                       ref={groupProvided.innerRef}
                                       {...groupProvided.draggableProps}
                                       style={{
                                          width: "100%",
                                          ...groupProvided.draggableProps.style,
                                       }}
                                    >
                                       <Collapse
                                          items={[
                                             {
                                                key: group.groupId,
                                                label: (
                                                   <Space
                                                      style={{
                                                         justifyContent:
                                                            "space-between",
                                                         width: "100%",
                                                      }}
                                                   >
                                                      <Space>
                                                         <Tooltip title="Drag to reorder groups">
                                                            <Button
                                                               type="text"
                                                               size="small"
                                                               icon={
                                                                  <HolderOutlined />
                                                               }
                                                               aria-label="Drag to reorder group"
                                                               {...groupProvided.dragHandleProps}
                                                               onClick={(
                                                                  event,
                                                               ) =>
                                                                  event.stopPropagation()
                                                               }
                                                               style={{
                                                                  cursor:
                                                                     "grab",
                                                               }}
                                                            />
                                                         </Tooltip>
                                                         <Typography.Text
                                                            strong
                                                         >
                                                            {group.groupName}
                                                         </Typography.Text>
                                                      </Space>
                                                      <Space>
                                                         <Button
                                                            size="small"
                                                            icon={
                                                               <PlusOutlined />
                                                            }
                                                            onClick={(
                                                               event,
                                                            ) => {
                                                               event.stopPropagation();
                                                               openCreateEnvironment(
                                                                  group.groupId,
                                                               );
                                                            }}
                                                         >
                                                            Add
                                                         </Button>
                                                         <Button
                                                            size="small"
                                                            icon={
                                                               <EditOutlined />
                                                            }
                                                            onClick={(
                                                               event,
                                                            ) => {
                                                               event.stopPropagation();
                                                               openRenameGroup(
                                                                  group,
                                                               );
                                                            }}
                                                         >
                                                            Rename
                                                         </Button>
                                                         <Button
                                                            size="small"
                                                            danger
                                                            icon={
                                                               <DeleteOutlined />
                                                            }
                                                            disabled={
                                                               group
                                                                  .environments
                                                                  .length > 0
                                                            }
                                                            onClick={(
                                                               event,
                                                            ) => {
                                                               event.stopPropagation();
                                                               handleDeleteGroup(
                                                                  group,
                                                               );
                                                            }}
                                                         >
                                                            Delete
                                                         </Button>
                                                      </Space>
                                                   </Space>
                                                ),
                                                children: (
                                                   <Droppable
                                                      droppableId={`group-${group.groupId}`}
                                                   >
                                                      {(provided) => (
                                                         <div
                                                            ref={
                                                               provided.innerRef
                                                            }
                                                            {...provided.droppableProps}
                                                            style={{
                                                               width: "100%",
                                                            }}
                                                         >
                                                            {group.environments
                                                               .length === 0 ? (
                                                               <Empty
                                                                  description="No environments in this group"
                                                                  image={
                                                                     Empty.PRESENTED_IMAGE_SIMPLE
                                                                  }
                                                               />
                                                            ) : (
                                                               <Space
                                                                  orientation="vertical"
                                                                  size="small"
                                                                  style={{
                                                                     width: "100%",
                                                                  }}
                                                               >
                                                                  {group.environments.map(
                                                                     (
                                                                        environment,
                                                                        index,
                                                                     ) => (
                                                                        <Draggable
                                                                           key={
                                                                              environment.id
                                                                           }
                                                                           draggableId={
                                                                              environment.id
                                                                           }
                                                                           index={
                                                                              index
                                                                           }
                                                                        >
                                                                           {(
                                                                              dragProvided,
                                                                           ) => (
                                                                              <Card
                                                                                 ref={
                                                                                    dragProvided.innerRef
                                                                                 }
                                                                                 {...dragProvided.draggableProps}
                                                                                 {...dragProvided.dragHandleProps}
                                                                                 size="small"
                                                                                 title={
                                                                                    environment.name
                                                                                 }
                                                                                 extra={
                                                                                    <Space>
                                                                                       <Button
                                                                                          size="small"
                                                                                          icon={
                                                                                             <EditOutlined />
                                                                                          }
                                                                                          onClick={() =>
                                                                                             openEditEnvironment(
                                                                                                environment,
                                                                                                group.groupId,
                                                                                             )
                                                                                          }
                                                                                       >
                                                                                          Edit
                                                                                       </Button>
                                                                                       <Button
                                                                                          size="small"
                                                                                          danger
                                                                                          icon={
                                                                                             <DeleteOutlined />
                                                                                          }
                                                                                          onClick={() =>
                                                                                             handleDeleteEnvironment(
                                                                                                environment,
                                                                                             )
                                                                                          }
                                                                                       >
                                                                                          Delete
                                                                                       </Button>
                                                                                    </Space>
                                                                                 }
                                                                              >
                                                                                 <Space
                                                                                    orientation="vertical"
                                                                                    size={
                                                                                       2
                                                                                    }
                                                                                    style={{
                                                                                       width: "100%",
                                                                                    }}
                                                                                 >
                                                                                    <Typography.Text>
                                                                                       <Typography.Text type="secondary">
                                                                                          Client
                                                                                          ID:{" "}
                                                                                       </Typography.Text>
                                                                                       {
                                                                                          environment.clientId
                                                                                       }
                                                                                    </Typography.Text>
                                                                                    <Typography.Text>
                                                                                       <Typography.Text type="secondary">
                                                                                          Client
                                                                                          Secret:{" "}
                                                                                       </Typography.Text>
                                                                                       {"•".repeat(
                                                                                          Math.max(
                                                                                             8,
                                                                                             String(
                                                                                                environment.clientSecret,
                                                                                             )
                                                                                                .length,
                                                                                          ),
                                                                                       )}
                                                                                    </Typography.Text>
                                                                                 </Space>
                                                                              </Card>
                                                                           )}
                                                                        </Draggable>
                                                                     ),
                                                                  )}
                                                               </Space>
                                                            )}
                                                            {
                                                               provided.placeholder
                                                            }
                                                         </div>
                                                      )}
                                                   </Droppable>
                                                ),
                                             },
                                          ]}
                                       />
                                    </div>
                                 )}
                              </Draggable>
                           ))}
                        </Space>
                        {groupsProvided.placeholder}
                     </div>
                  )}
               </Droppable>
            </DragDropContext>
         )}

         <Modal
            title={editingEnvironment ? "Edit Environment" : "Add Environment"}
            open={isEnvironmentModalOpen}
            onCancel={() => setIsEnvironmentModalOpen(false)}
            onOk={handleEnvironmentSubmit}
            okText={editingEnvironment ? "Update" : "Create"}
         >
            <Form<FormValues> form={form} layout="vertical">
               <Form.Item
                  name="groupId"
                  label="Group"
                  rules={[{ required: true, message: "Group is required." }]}
               >
                  <Select
                     placeholder="Select group"
                     options={groups.map((group) => ({
                        label: group.groupName,
                        value: group.groupId,
                     }))}
                  />
               </Form.Item>
               <Form.Item
                  name="name"
                  label="Environment Name"
                  rules={[
                     {
                        required: true,
                        message: "Environment name is required.",
                     },
                     {
                        validator: async (_, value) => {
                           if (!value || !value.trim()) {
                              return;
                           }

                           if (
                              environmentNameExists(
                                 value,
                                 editingEnvironment?.id,
                              )
                           ) {
                              throw new Error(
                                 "Environment name must be unique.",
                              );
                           }
                        },
                     },
                  ]}
               >
                  <Input placeholder="Dev / UAT / Production" />
               </Form.Item>
               <Form.Item
                  name="clientId"
                  label="Client ID"
                  rules={[
                     { required: true, message: "Client ID is required." },
                  ]}
               >
                  <Input placeholder="Client ID" />
               </Form.Item>
               <Form.Item
                  name="clientSecret"
                  label="Client Secret"
                  rules={[
                     { required: true, message: "Client secret is required." },
                  ]}
               >
                  <Input.Password placeholder="Client Secret" />
               </Form.Item>
            </Form>
         </Modal>

         <Modal
            title={editingGroup ? "Rename Group" : "Create Group"}
            open={isGroupModalOpen}
            onCancel={() => setIsGroupModalOpen(false)}
            onOk={handleGroupSubmit}
            okText={editingGroup ? "Rename" : "Create"}
         >
            <Form<GroupFormValues> form={groupForm} layout="vertical">
               <Form.Item
                  name="groupName"
                  label="Group Name"
                  rules={[
                     { required: true, message: "Group name is required." },
                     {
                        validator: async (_, value) => {
                           if (!value || !value.trim()) {
                              return;
                           }

                           if (groupNameExists(value, editingGroup?.groupId)) {
                              throw new Error("Group name must be unique.");
                           }
                        },
                     },
                  ]}
               >
                  <Input placeholder="Group name" />
               </Form.Item>
            </Form>
         </Modal>
      </Space>
   );
};
